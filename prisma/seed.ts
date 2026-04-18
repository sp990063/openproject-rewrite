import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Starting seed...')

  // ============================================
  // ROLES
  // ============================================
  console.log('Creating roles...')

  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      permissions: ['manage_project', 'manage_members', 'manage_work_packages', 'view_work_packages'],
    },
  })

  const memberRole = await prisma.role.upsert({
    where: { name: 'Member' },
    update: {},
    create: {
      name: 'Member',
      permissions: ['manage_work_packages', 'view_work_packages'],
    },
  })

  const viewerRole = await prisma.role.upsert({
    where: { name: 'Viewer' },
    update: {},
    create: {
      name: 'Viewer',
      permissions: ['view_work_packages'],
    },
  })

  console.log(`✓ Roles created: Admin, Member, Viewer`)

  // ============================================
  // STATUSES
  // ============================================
  console.log('Creating statuses...')

  const statuses = [
    { name: 'New', color: '#3498db', position: 0, isClosed: false },
    { name: 'In Progress', color: '#f39c12', position: 1, isClosed: false },
    { name: 'Resolved', color: '#27ae60', position: 2, isClosed: false },
    { name: 'Closed', color: '#2c3e50', position: 3, isClosed: true },
  ]

  for (const status of statuses) {
    await prisma.status.upsert({
      where: { id: status.name.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: status,
    })
  }

  console.log(`✓ Statuses created: ${statuses.map((s) => s.name).join(', ')}`)

  // ============================================
  // TYPES
  // ============================================
  console.log('Creating types...')

  const types = [
    { name: 'Task', color: '#3498db', position: 0, isMilestone: false },
    { name: 'Bug', color: '#e74c3c', position: 1, isMilestone: false },
    { name: 'Feature', color: '#9b59b6', position: 2, isMilestone: false },
    { name: 'Milestone', color: '#f1c40f', position: 3, isMilestone: true },
  ]

  for (const type of types) {
    await prisma.type.upsert({
      where: { id: type.name.toLowerCase() },
      update: {},
      create: type,
    })
  }

  console.log(`✓ Types created: ${types.map((t) => t.name).join(', ')}`)

  // ============================================
  // PRIORITIES
  // ============================================
  console.log('Creating priorities...')

  const priorities = [
    { name: 'Low', color: '#95a5a6', position: 0 },
    { name: 'Normal', color: '#3498db', position: 1 },
    { name: 'High', color: '#f39c12', position: 2 },
    { name: 'Urgent', color: '#e74c3c', position: 3 },
  ]

  for (const priority of priorities) {
    await prisma.priority.upsert({
      where: { id: priority.name.toLowerCase() },
      update: {},
      create: priority,
    })
  }

  console.log(`✓ Priorities created: ${priorities.map((p) => p.name).join(', ')}`)

  // ============================================
  // DEMO USER
  // ============================================
  console.log('Creating demo user...')

  const passwordHash = await bcrypt.hash('demo123', 12)

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      passwordHash,
      isSystemAdmin: true,
    },
  })

  console.log(`✓ Demo user created: ${demoUser.email} (password: demo123)`)

  // ============================================
  // DEMO PROJECT
  // ============================================
  console.log('Creating demo project...')

  const demoProject = await prisma.project.upsert({
    where: { identifier: 'demo-project' },
    update: {},
    create: {
      name: 'Demo Project',
      identifier: 'demo-project',
      description: 'This is a demo project for testing purposes.',
      status: 'active',
    },
  })

  // Add demo user as admin member
  await prisma.member.upsert({
    where: {
      userId_projectId: {
        userId: demoUser.id,
        projectId: demoProject.id,
      },
    },
    update: {},
    create: {
      userId: demoUser.id,
      projectId: demoProject.id,
      roleId: adminRole.id,
    },
  })

  console.log(`✓ Demo project created: ${demoProject.identifier}`)

  // ============================================
  // DEMO WORK PACKAGES
  // ============================================
  console.log('Creating demo work packages...')

  const newStatus = await prisma.status.findUnique({ where: { name: 'New' } })
  const inProgressStatus = await prisma.status.findUnique({ where: { name: 'In Progress' } })
  const taskType = await prisma.type.findUnique({ where: { name: 'Task' } })
  const bugType = await prisma.type.findUnique({ where: { name: 'Bug' } })
  const normalPriority = await prisma.priority.findUnique({ where: { name: 'Normal' } })
  const highPriority = await prisma.priority.findUnique({ where: { name: 'High' } })

  const workPackages = [
    {
      subject: 'Set up project infrastructure',
      description: 'Initialize the project with Next.js, configure database, and set up authentication.',
      statusId: inProgressStatus!.id,
      typeId: taskType!.id,
      priorityId: highPriority!.id,
      position: 0,
    },
    {
      subject: 'Design database schema',
      description: 'Create Prisma schema for all entities.',
      statusId: newStatus!.id,
      typeId: taskType!.id,
      priorityId: normalPriority!.id,
      position: 1,
    },
    {
      subject: 'Fix login page bug',
      description: 'Users cannot log in with special characters in password.',
      statusId: newStatus!.id,
      typeId: bugType!.id,
      priorityId: highPriority!.id,
      position: 2,
    },
  ]

  for (const wp of workPackages) {
    await prisma.workPackage.create({
      data: {
        ...wp,
        projectId: demoProject.id,
        authorId: demoUser.id,
      },
    })
  }

  console.log(`✓ ${workPackages.length} demo work packages created`)

  // ============================================
  // PROJECT MODULES
  // ============================================
  console.log('Enabling project modules...')

  const modules = [
    'work_packages',
    'gantt',
    'board',
    'calendar',
    'wiki',
    'forums',
    'documents',
    'meetings',
    'time_tracking',
  ]

  for (const module of modules) {
    await prisma.projectModule.upsert({
      where: {
        projectId_module: {
          projectId: demoProject.id,
          module,
        },
      },
      update: {},
      create: {
        projectId: demoProject.id,
        module,
        enabled: module === 'work_packages', // Only work_packages enabled by default
      },
    })
  }

  console.log(`✓ Project modules configured`)

  console.log('✅ Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
