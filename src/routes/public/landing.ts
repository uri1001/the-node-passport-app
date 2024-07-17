import express from 'express'

import { rootPublic as root } from '../../system.js'

const router = express.Router()

router.get('/', (_req, res) => {
    res.sendFile('landing.html', { root })
})

export default router
