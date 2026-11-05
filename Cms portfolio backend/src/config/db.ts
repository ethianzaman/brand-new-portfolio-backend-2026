import mongoose from 'mongoose'

export async function connectDB(): Promise<void> {
  try {
    const uri = process.env.MONGODB_URI!
    await mongoose.connect(uri, {
      maxPoolSize: 20,
      // Warm connections spare the first request a slow handshake.
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10_000,
    })
    console.log('✅ MongoDB connected')
  } catch (err) {
    console.error('❌ MongoDB connection error:', err)
    process.exit(1)
  }
}