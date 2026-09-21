import 'dotenv/config'
import express    from 'express'
import cors       from 'cors'
import { connectDB }    from './config/db'
import { errorHandler } from './middleware/errorHandler'

import authRoutes    from './routes/auth.routes'
import projectRoutes from './routes/project.routes'

import cookieParser from 'cookie-parser';
import skillRoutes   from './routes/skill.routes'
import serviceRoutes from './routes/service.routes'
import aboutRoutes   from './routes/about.routes'
import contactRoutes from './routes/contact.routes'
import blogRoutes    from './routes/blog.routes'
import homeRoutes    from './routes/home.routes'
const app  = express()
app.use(express.json());
const PORT = process.env.PORT ?? 5000

app.use(cookieParser());

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(express.json())

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/skills',   skillRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/about',    aboutRoutes)
app.use('/api/contact',  contactRoutes)
app.use('/api/blogs',    blogRoutes)
app.use('/api/home',     homeRoutes)

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({ success: true, message: 'API is running' })
})

// ── Error handler ─────────────────────────────────────────────
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
  })
})

// ── Seed admin on first start ─────────────────────────────────
import { User } from './models/User'

async function seedAdmin() {
  const exists = await User.findOne({ email: process.env.ADMIN_EMAIL })
  if (!exists) {
    await User.create({
      email:    process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
    console.log('✅ Admin user seeded')
  }
}

connectDB().then(seedAdmin)