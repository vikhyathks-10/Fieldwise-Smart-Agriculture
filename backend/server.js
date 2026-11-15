
import express from 'express'
import cors from 'cors'

import './database/config/env.js'

import { pool } from './database/connection/pool.js'
import {
    connectMongoDB,
    disconnectMongoDB
} from './database/connection/mongodb.js'

import { routes } from './application/routes/index.js'
import { errorHandler } from './application/middleware/errorHandler.js'

const app = express()

app.disable('x-powered-by')

const allowedOrigins = new Set(
    String(process.env.CORS_ORIGIN || 'http://localhost:5173')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
)

app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.has(origin)) {
                return callback(null, true)
            }

            return callback(new Error('Origin is not allowed by CORS.'))
        },
        credentials: true
    })
)

app.use(express.json({ limit: '1mb' }))

app.use('/api', routes)

app.use(errorHandler)

const PORT = Number(process.env.PORT || 4000)

let server
let shuttingDown = false

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

async function shutdown(signal) {
    if (shuttingDown) return

    shuttingDown = true

    console.log(`\n${signal} received. Shutting down server...`)

    try {
        if (server) {
            await new Promise((resolve, reject) => {
                server.close(error => {
                    if (error) reject(error)
                    else resolve()
                })
            })
        }

        await disconnectMongoDB()
        console.log('MongoDB disconnected.')

        await pool.end()
        console.log('MySQL connection pool closed.')

        console.log('Server shutdown completed.')

        process.exit(0)
    } catch (error) {
        console.error('Error during server shutdown:', error)
        process.exit(1)
    }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// =====================================================
// START SERVER
// =====================================================

async function startServer() {
    try {
        console.log('Connecting to MongoDB...')

        await connectMongoDB()

        console.log('MongoDB connection established.')

        server = app.listen(PORT, () => {
            console.log(`Smart Agriculture API listening on port ${PORT}`)
        })
    } catch (error) {
        console.error('Server startup failed:', error.message)

        try {
            await disconnectMongoDB()
            await pool.end()
        } catch (shutdownError) {
            console.error('Database cleanup failed:', shutdownError.message)
        }

        process.exit(1)
    }
}

startServer()
