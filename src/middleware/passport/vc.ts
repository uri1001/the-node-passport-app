import jwt from 'jsonwebtoken'
import { Strategy as CustomStrategy, type VerifiedCallback } from 'passport-custom'

import { type Request } from 'express'

import { AuthStrategies } from '../../services/index.js'

import { getAccount, type Account } from '../../db/index.js'

import { getEnv } from '../../system.js'
import { logAuthentication } from '../log.js'

interface JwtStoredValue {
    pointer: string
    value: any
    index: [number, number | null]
}

const verifyJwt = (token: string): jwt.JwtPayload => {
    const decodedKey = getEnv('VC_PROVIDER_PUBLIC_KEY').replace(/\\n/g, '\n')
    const jwtPayload = jwt.verify(token, decodedKey, {
        algorithms: ['ES256'],
        ignoreNotBefore: true,
    })
    if (typeof jwtPayload === 'string') throw new Error('jwtpayload type not valid')
    return jwtPayload
}

const extractValueJwt = (jwtPayload: jwt.JwtPayload, pointer: string): string => {
    const storedValues: JwtStoredValue[] = JSON.parse(jwtPayload.stored_values)
    for (const storedValue of storedValues)
        if (storedValue.pointer === pointer) return storedValue.value
    throw new Error('undefined jwt payload property')
}

const verifyAccount = (req: Request, done: VerifiedCallback): void => {
    try {
        const token = req.query.token as string
        if (token == null) throw new Error('undefined jwt')

        const jwtPayload = verifyJwt(token)

        const payload = {
            email: extractValueJwt(jwtPayload, '/credentialSubject/email'),
        }

        const account: Account | undefined = getAccount(payload.email)

        logAuthentication(AuthStrategies.VC, jwtPayload, account)

        const user = account == null ? payload : account

        done(null, user)
    } catch (error) {
        console.error(error)
        done(null, false)
    }
}

const vcStrategy = new CustomStrategy(verifyAccount)

export default vcStrategy
