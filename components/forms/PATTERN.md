// components/forms/PATTERN.md
// Reference pattern for migrating existing form pages from raw useState /
// e.preventDefault → react-hook-form + Zod + our <FormField> primitives.
//
// SPEC: revamp-v2/design/01-uiux-design.md §10 (Forms), §11 (Validation)
//   - One source of truth for both validation and TS types (Zod → z.infer)
//   - No manual useState for fields, no manual error tracking
//   - <FormField> auto-displays Zod errors via react-hook-form's `formState.errors`
//   - <FormSection> provides card-like grouping
//   - <FormError> shows top-of-form summary when there are issues
//
// DEPENDENCIES (already installed):
//   - react-hook-form@7.77.0
//   - @hookform/resolvers@5.4.0
//   - zod (4.x — note: Zod 4 changed some APIs; the resolver from
//     @hookform/resolvers/zod expects Zod 4 input shapes)

## Step 1: Define the Zod schema

Place the schema at the top of the form file (or in a `schemas.ts` if shared).

```ts
import { z } from 'zod'

const meetingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(120, 'Max 120 chars'),
  description: z.string().max(2000).optional().or(z.literal('')),
  startTime: z.string().min(1, 'Start time is required'),
  duration: z.coerce.number().int().min(15, 'Min 15 min').max(480, 'Max 8 hours'),
  location: z.string().max(120).optional().or(z.literal('')),
  isPrivate: z.boolean().default(false),
})

type MeetingInput = z.infer<typeof meetingSchema>
```

Notes:
- Use `z.coerce.number()` for HTML `<input type="number">` values which are
  always strings in JS.
- Use `.optional().or(z.literal(''))` for fields where the empty string is
  semantically equivalent to "not set" — otherwise the schema rejects ''.
- Boolean fields map to `<input type="checkbox">`.

## Step 2: Set up the form hook

```ts
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const {
  control,           // passed to <FormField control={...} />
  handleSubmit,
  formState: { errors, isSubmitting },
  reset,
  setValue,
  setError,          // for surfacing server / cross-field errors
  watch,
} = useForm<MeetingInput>({
  resolver: zodResolver(meetingSchema),
  defaultValues: {
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    startTime: initial?.startTime ?? '',
    duration: initial?.duration ?? 60,
    location: initial?.location ?? '',
    isPrivate: initial?.isPrivate ?? false,
  },
})
```

## Step 3: Replace JSX with <FormField> primitives

BEFORE (raw useState + manual error display):
```tsx
const [title, setTitle] = useState('')
const [error, setError] = useState<string | null>(null)
// ...
<Input
  label="Title"
  value={title}
  onChange={(e) => setTitle(e.target.value)}
  error={error ?? undefined}
/>
```

AFTER (RHF + FormField via Controller):
```tsx
// FormField is a Controller-based wrapper — pass `control` + `name`,
// do NOT spread `register` onto it. FormField reads field state and
// renders the Zod message automatically.
const { control } = useForm<MeetingInput>({ resolver: zodResolver(meetingSchema) })

<FormField
  control={control}
  name="title"
  label="Title"
  required
/>
```

FormField forwards its `name` prop into a `<Controller>` and the
auto-derived `fieldState.error?.message` renders the Zod message directly.

## Step 4: Form section + error summary

```tsx
<FormSection title="Meeting details" description="Tell participants what to expect">
  {/* FormError takes EITHER an `errors` object (RHF) OR a `{ issues }` payload. */}
  {/* To show only after first submit, guard it with submitCount > 0. */}
  {submitCount > 0 && <FormError error={errors} />}
  <FormField control={control} name="title" label="Title" required />
  <FormField
    control={control}
    name="description"
    label="Description"
    type="textarea"
  />
  <div className="grid grid-cols-2 gap-4">
    {/* FormField supports: 'text' | 'email' | 'number' | 'textarea' | 'select' */}
    {/* For 'datetime-local' / 'date' / 'password' / 'checkbox' / radio, */}
    {/* bypass FormField and use a raw <Controller> with the design-system Input. */}
    <Controller
      control={control}
      name="startTime"
      render={({ field, fieldState }) => (
        <Input
          type="datetime-local"
          label="Start time"
          required
          value={field.value ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
    <FormField
      control={control}
      name="duration"
      label="Duration (min)"
      type="number"
    />
  </div>
  <FormField control={control} name="location" label="Location" />
  <Controller
    control={control}
    name="isPrivate"
    render={({ field }) => (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!field.value}
          onChange={(e) => field.onChange(e.target.checked)}
          onBlur={field.onBlur}
        />
        <span className="text-sm">Private meeting (invite only)</span>
      </label>
    )}
  />
</FormSection>
```

## Step 5: Submit handler

```ts
const onSubmit = handleSubmit(async (values) => {
  // `values` is fully typed (MeetingInput) and validated.
  try {
    await createMeeting.mutateAsync(values)
    reset()
    onSuccess?.()
  } catch (err) {
    // Show a top-level error via the form's setError.
    setError('root', {
      type: 'server',
      message: err instanceof Error ? err.message : 'Save failed',
    })
  }
})

// In JSX:
<Button type="submit" isLoading={isSubmitting}>Save</Button>
```

## Step 6: Schema → API payload mapper (CRITICAL for Zod 4)

⚠️ **Zod 4 input/output type variance trap**: when the form's schema uses
`.optional()`, `.default()`, `.transform()`, or `.refine()` with input
mutation, the **input** type (`z.input<typeof schema>`) and **output** type
(`z.output<typeof schema>`) diverge. RHF's `Control<T, _, T>` requires the
input and output types to be identical, otherwise you get 4 type errors
about `Control<T, _, T>` being unassignable.

**Fix**: define the form values type from `z.infer<typeof schema>` (output)
and supply ALL defaults via `useForm({ defaultValues })`, NOT via
`.default()` on the schema. This keeps input = output.

If the API expects a different shape than the form (e.g. ISO strings
instead of `datetime-local` strings), write a `toApiPayload()` mapper:

```ts
function toApiPayload(v: MeetingInput) {
  return {
    ...v,
    startTime: v.startTime ? new Date(v.startTime).toISOString() : null,
    attendeeIds: v.attendeeIds ?? [],
  }
}

const onSubmit = handleSubmit(async (values) => {
  await createMeeting.mutateAsync(toApiPayload(values))
})
```

The 5 production migrations (MeetingForm, ProjectCreate, WorkPackageInlineEdit,
Announcements, Webhooks) all hit this trap on the first try and required
this workaround.

## Step 7: Remove dead code

After migration, search for and delete:
- `useState<...>` for any field
- `setError('')` / manual error string state
- `e.preventDefault()` in form onSubmit
- Manual `if (!title) { setError(...); return }` validation
- The old `Input label=... error=...` usage pattern (replaced by FormField)

## Edge cases

### Pre-filling from server data (edit mode)
The form component receives `initial?: Partial<MeetingInput>`. Pass each
field as a `defaultValue` to `useForm()`. If the data loads asynchronously
(e.g. via SWR/React Query), use `reset(data)` inside a `useEffect([data])`.

### Multi-step forms
Each step is its own `<FormSection>` showing/hiding via local state. The
single `useForm()` instance spans the whole flow — `handleSubmit` only
fires on the final submit.

### File uploads
Use `register('file')` and the underlying `<input type="file">` FormField.
For S3 presigned uploads, watch the file via `watch('file')` and trigger
the upload manually on submit.

### Dynamic field arrays
For repeatable rows, use `useFieldArray` from RHF. Not used in any of
the current 5 migration targets — defer if needed.

## Why this pattern

- **Type safety**: `z.infer<typeof schema>` is the form's data model. The
  mutation hook can type its payload as `MeetingInput` and TypeScript
  guarantees no field is missed.
- **Single error path**: Zod produces `errors.fieldName.message` strings;
  the FormField reads them and renders. No `useState<string | null>` for
  per-field errors.
- **Schema is shareable**: A `meetingSchema` defined for the form can be
  reused for API validation in `pages/api/meetings/...` via Zod parsing
  in the withRoute HOF.
- **Testable**: A `meetingSchema.safeParse(values)` call in unit tests
  gives fast feedback without rendering the form.

## Reference example

The full reference implementation lives in
`pages/projects/[projectId]/settings/profile-v2.tsx` (the demo page).
Read that file end-to-end before starting any migration.
