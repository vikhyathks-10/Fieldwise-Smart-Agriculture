import { connectMongoDB, disconnectMongoDB } from './mongodb.js'

try {
    await connectMongoDB()

    const result = await (
        await import('mongoose')
    ).default.connection.db.admin().ping()

    console.log('MongoDB ping result:', result)
} catch (error) {
    console.error('MongoDB connection failed:', error.message)
    process.exitCode = 1
} finally {
    await disconnectMongoDB()
}