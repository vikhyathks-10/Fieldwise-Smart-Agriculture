import mongoose from 'mongoose'
import '../config/env.js'

export async function connectMongoDB() {
    const uri = process.env.MONGODB_URI

    if (!uri) {
        throw new Error('MONGODB_URI is missing from backend/.env')
    }

    await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000
    })

    console.log(`MongoDB connected: ${mongoose.connection.name}`)
}

export async function disconnectMongoDB() {
    await mongoose.disconnect()
}