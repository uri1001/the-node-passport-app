import axios from 'axios'

import { logApiRequest } from '../../log.js'

export const reqTokenOauth = async (
    url: string,
    id: string,
    key: string,
    code: string,
): Promise<URLSearchParams> => {
    const data = {
        client_id: id,
        client_secret: key,
        code,
    }

    const res = await axios.post(url, data)
    logApiRequest(true, url, data, res.data)

    return new URLSearchParams(res.data)
}

export const reqUserDataOauth = async (url: string, accessToken: string): Promise<any> => {
    const headers = {
        Authorization: `Bearer ${accessToken}`,
    }

    const res = await axios.get(url, { headers })
    logApiRequest(true, url, undefined, res.data)

    return res.data
}
