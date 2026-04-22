import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, Input, Badge, Modal } from '@/components/ui'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'
import { Select } from '@/components/ui'

// ---- Button ----
describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('applies primary variant by default', () => {
    render(<Button>Primary</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-blue-600')
  })

  it('applies danger variant', () => {
    render(<Button variant="danger">Delete</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-red-600')
  })

  it('applies sm size', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('px-3')
  })

  it('applies lg size', () => {
    render(<Button size="lg">Large</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('px-6')
  })

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows spinner when isLoading', () => {
    render(<Button isLoading>Loading</Button>)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    render(<Button onClick={handler}>Click</Button>)
    await user.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })
})

// ---- Input ----
describe('Input', () => {
  it('renders input element', () => {
    render(<Input />)
    expect(document.querySelector('input')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<Input label="Email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('renders error message when provided', () => {
    render(<Input label="Email" error="Invalid email" />)
    expect(screen.getByText('Invalid email')).toBeInTheDocument()
  })

  it('applies error border style', () => {
    render(<Input label="Email" error="Invalid" />)
    expect(document.querySelector('input')!.className).toContain('border-red-500')
  })

  it('forwards ref', () => {
    const ref = { current: null } as React.RefObject<HTMLInputElement>
    render(<Input ref={ref} />)
    expect(ref.current).not.toBeNull()
  })
})

// ---- Badge ----
describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('applies success variant', () => {
    render(<Badge variant="success">Active</Badge>)
    expect(screen.getByText('Active').className).toContain('bg-green-100')
  })

  it('applies danger variant', () => {
    render(<Badge variant="danger">Bug</Badge>)
    expect(screen.getByText('Bug').className).toContain('bg-red-100')
  })

  it('applies default variant', () => {
    render(<Badge variant="default">Default</Badge>)
    expect(screen.getByText('Default').className).toContain('bg-gray-100')
  })
})

// ---- Select ----
describe('Select', () => {
  it('renders select with options', () => {
    render(
      <Select
        label="Status"
        options={[
          { value: 'new', label: 'New' },
          { value: 'open', label: 'Open' },
        ]}
      />
    )
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('renders placeholder', () => {
    render(
      <Select
        label="Status"
        placeholder="Choose a status"
        options={[{ value: 'new', label: 'New' }]}
      />
    )
    expect(screen.getByText('Choose a status')).toBeInTheDocument()
  })

  it('applies error style', () => {
    render(
      <Select
        label="Status"
        error="Required"
        options={[{ value: 'new', label: 'New' }]}
      />
    )
    expect(screen.getByRole('combobox').className).toContain('border-red-500')
  })
})

// ---- Tabs ----
describe('Tabs', () => {
  it('renders tab list and triggers', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )
    expect(screen.getByText('Tab 1')).toBeInTheDocument()
    expect(screen.getByText('Tab 2')).toBeInTheDocument()
  })

  it('shows active tab content', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )
    expect(screen.getByText('Content 1')).toBeInTheDocument()
  })
})
