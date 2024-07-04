import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { type Response } from 'express'
import jwt from 'jsonwebtoken'

import { fetchDb, insertDb, type User } from '../db/index.js'

import { getEnv } from '../system.js'

import { logJwt } from './log.js'

export enum AuthStrategies {
    JWT = 'local-jwt',
    OAUTH = 'github',
    OIDC = 'google',
    PWD = 'local-pwd',
    RADIUS = 'radius',
    VC = 'werify',
}

const hashPassword = (kdf: string, pwd: string): string => {
    console.log(`\nPassword Hash`)
    console.time('key-derivation-function')
    const rounds = kdf === 'slow' ? 16 : 10
    const salt = bcrypt.genSaltSync(rounds)
    const pwdHash = bcrypt.hashSync(pwd, salt)
    console.timeEnd('key-derivation-function')
    console.log(`Generated Hash - ${pwdHash}\n`)
    return pwdHash
}

const issueJwt = (auth: AuthStrategies, user: User, res: Response): void => {
    const jwtClaims = {
        // id
        jti: user.id,
        // user
        sub: user.username,
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        email_verified: user.emailVerified,
        // company
        company_id: user.companyId,
        company_name: user.companyName,
        company_workplace: user.companyWorkplace,
        employee_id: user.employeeId,
        employee_role: user.employeeRole,
        // json web token
        iss: auth,
        aud: 'localhost',
        exp: Math.floor(Date.now() / 1000) + Number(getEnv('JWT_SESSION_LENGTH_SECONDS')),
    }

    const token = jwt.sign(jwtClaims, getEnv('JWT_PRIVATE_KEY'))

    res.cookie('auth-jwt', token, {
        httpOnly: true,
        secure: true,
    })

    logJwt(token, getEnv('JWT_PRIVATE_KEY'))
}

// auth db validation
const registeredUser = (auth: AuthStrategies, req: any): User | undefined => {
    let userKey: string = ''

    switch (auth) {
        case AuthStrategies.OAUTH:
            userKey = req.login
            break
        case AuthStrategies.OIDC:
            userKey = req.user.email
            break
        case AuthStrategies.PWD:
            userKey = req.body.username
            break
        case AuthStrategies.RADIUS:
            userKey = req.user.username
            break
        case AuthStrategies.VC:
            userKey = req.user.email
            break
    }

    const user = fetchDb('users', 'user', userKey)

    if (user.length > 1) throw new Error('invalid database fetch')

    return user[0] as User
}

export const registerUser = (auth: AuthStrategies, req: any): void => {
    if (auth === AuthStrategies.JWT) throw new Error('jwt authetication strategy not valid')

    // fetch database user
    const dbUser: User | undefined = registeredUser(auth, req)

    // validate user registration
    if (!(dbUser == null)) {
        // ensure user is not registered - username-password registration
        if (auth === AuthStrategies.PWD) throw new Error('user already registered in database')
        // finalize registration - user already registered
        return
    }

    // user requested to register
    const user: User = {
        id: randomUUID(),
        user: '',
        username: '',
        firstName: '',
        lastName: '',
        email: '',
        emailVerified: false,
    }

    if (auth === AuthStrategies.OAUTH) {
        user.user = req.login
        user.username = req.login
        user.email = req.login
        user.employeeRole = 'user'
    } else if (auth === AuthStrategies.OIDC) {
        user.user = req.user.email
        user.username = req.user.email
        user.firstName = req.user.given_name
        user.lastName = req.user.family_name
        user.email = req.user.email
        user.emailVerified = req.user.email_verified
        user.employeeRole = 'user'
    } else if (auth === AuthStrategies.PWD) {
        user.user = req.body.username
        user.username = req.body.username
        user.email = req.body.email
        user.password = hashPassword(req.body.kdf, req.body.password)
    } else if (auth === AuthStrategies.RADIUS) {
        user.user = req.user.username
        user.username = req.user.username
        user.email = req.user.username
        user.emailVerified = true
        user.employeeRole = 'user'
    } else if (auth === AuthStrategies.VC) {
        // TODO
        user.email = req.email
    }

    // TODO: LOG REGISTRATION REQUEST

    // ensure user key exists
    if (user.user === '') throw new Error('undefined user key')

    insertDb('users', user)
}

export const loginUser = (auth: AuthStrategies, req: any, res?: Response): void => {
    // ensure user is registered in database
    const user: User | undefined = registeredUser(auth, req)
    if (user == null) throw new Error('user not registered in database')

    // issue jwt if response is provided - start jwt session
    if (res != null) issueJwt(auth, user, res)
}

/*
const jwtClaims = {
    jti: id,
    sub: username,
    role,
    email,
    name: givenName,
    fam: familyName,
    iss: 'google',
    aud: 'localhost:3000',
    exp: Math.floor(Date.now() / 1000) + Number(getEnv('JWT_SESSION_LENGTH_SECONDS')),
}
*/
