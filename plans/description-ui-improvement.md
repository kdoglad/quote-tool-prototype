# Description Display UI Improvement Plan

## Current Issues Identified

Based on the code analysis of [`LineItemRow.tsx`](../src/components/quote/LineItemRow.tsx:347-426), the current implementation has several problems:

### 1. **Rigid Main Descriptor Box** (Lines 347-376)
- Everything is crammed into a single line with `flex items-center`
- Item name and main descriptor are forced to share space with `truncate`
- The label and value are squeezed together with minimal spacing
- Hard to read when content is long

### 2. **Poor Visual Hierarchy**
- Item name (most important) doesn't stand out enough
- Field label and value have similar visual weight
- No clear distinction between "what it is" vs "its properties"

### 3. **Expanded Tags Are Too Small** (Lines 413-426)
- Text is only `text-[11px]` - very small
- Tags blend together with minimal contrast
- Hard to scan multiple fields quickly

### 4. **Unclear Field Purpose**
- Can't tell which field is being used as the main descriptor
- No indication of field importance or type

## Proposed Solution

### Design Principles
1. **Multi-line layout** - Don't force everything on one line
2. **Clear hierarchy** - Item name > Main descriptor > Other specs
3. **Readable sizing** - Larger text, better spacing
4. **Visual clarity** - Use color, weight, and spacing to guide the eye

### New Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ [Item Name in Bold]                          [Show/Hide] [fx]│
│ Main Field: Value in prominent display                       │
├─────────────────────────────────────────────────────────────┤
│ When expanded:                                               │
│ [Field 1: Value]  [Field 2: Value]  [Field 3: Value]        │
│ [Field 4: Value]  [Field 5: Value]                          │
└─────────────────────────────────────────────────────────────┘
```

### Specific Improvements

#### 1. Main Descriptor Box
- **Multi-line layout** with proper vertical spacing
- **Item name on its own line** - larger, bolder, more prominent
- **Main descriptor on second line** - clear label + value separation
- **Better padding** - more breathing room (py-2 instead of py-1)
- **Softer borders** - rounded-lg for friendlier appearance

#### 2. Visual Hierarchy
- Item name: `text-sm font-semibold` (currently mixed with descriptor)
- Main descriptor label: `text-xs text-slate-500` (subtle)
- Main descriptor value: `text-sm text-slate-200` (prominent)
- Expanded tags: `text-xs` (up from text-[11px])

#### 3. Expanded Spec Tags
- **Larger text** - `text-xs` instead of `text-[11px]`
- **Better contrast** - darker background, lighter text
- **More padding** - `px-2 py-1` instead of `px-1.5 py-0.5`
- **Clearer labels** - bold field names with colon separator
- **Better spacing** - `gap-2` instead of `gap-1`

#### 4. Color & Contrast Improvements
- **Collapsed state**: Subtle slate-800 background
- **Expanded state**: Brand-tinted background (brand-900/30)
- **Hover state**: Brighter border to indicate interactivity
- **Field labels**: Muted but readable (slate-500)
- **Field values**: Clear and prominent (slate-200)

### Implementation Details

#### Main Descriptor Box Changes
```tsx
// OLD: Single line, cramped
<button className="flex items-center justify-between gap-1.5 px-2.5 py-1">
  <span className="truncate flex items-center gap-2">
    <span className="font-semibold truncate">{item.name}</span>
    <span className="truncate flex items-center text-[11px]">
      <span className="mr-1">{mainDescriptor.label}:</span>
      <span>{mainDescriptor.value}</span>
    </span>
  </span>
</button>

// NEW: Multi-line, spacious
<button className="flex flex-col items-start gap-1 px-3 py-2">
  <div className="flex items-center justify-between w-full">
    <span className="text-sm font-semibold text-slate-100">
      {item.name}
    </span>
    <span className="text-[10px] text-slate-500">
      {descOpen ? 'Hide' : 'Show'}
    </span>
  </div>
  {mainDescriptor.value !== item.name && (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-slate-500 font-medium">
        {mainDescriptor.label}:
      </span>
      <span className="text-sm text-slate-200">
        {mainDescriptor.value}
      </span>
    </div>
  )}
</button>
```

#### Expanded Tags Changes
```tsx
// OLD: Tiny, cramped
<span className="text-[11px] bg-slate-800/60 px-1.5 py-0.5">
  <span className="text-slate-500 font-medium">{field.label}:</span> {displayVal}
</span>

// NEW: Readable, spacious
<span className="text-xs bg-slate-800 px-2 py-1 rounded border border-slate-700">
  <span className="text-slate-400 font-semibold">{field.label}:</span>{' '}
  <span className="text-slate-200">{displayVal}</span>
</span>
```

## Visual Mockup

### Before (Current)
```
┌────────────────────────────────────────────┐
│ [Item Name Main: Value Show]          [fx] │ ← Everything cramped
└────────────────────────────────────────────┘
Expanded:
[F1:Val] [F2:Val] [F3:Val] ← Tiny, hard to read
```

### After (Improved)
```
┌────────────────────────────────────────────┐
│ Item Name                    Show      [fx] │ ← Clear, prominent
│ Main Field: Value                          │ ← Easy to read
└────────────────────────────────────────────┘
Expanded:
[Field 1: Value]  [Field 2: Value]  ← Readable tags
[Field 3: Value]  [Field 4: Value]
```

## Benefits

1. **Improved Readability** - Larger text, better spacing
2. **Clear Hierarchy** - Easy to identify item name and main specs
3. **Better Scannability** - Can quickly find information
4. **More Professional** - Polished, modern appearance
5. **Maintains Functionality** - All existing features preserved
6. **Responsive** - Works well with varying content lengths

## Implementation Steps

1. Update main descriptor button layout from single-line to multi-line
2. Adjust text sizes and spacing for better hierarchy
3. Improve expanded tag styling with larger text and better contrast
4. Add proper padding and border radius for softer appearance
5. Update color scheme for better visual separation
6. Test with various item types to ensure consistency
7. Verify responsive behavior with long field names/values

## Files to Modify

- [`src/components/quote/LineItemRow.tsx`](../src/components/quote/LineItemRow.tsx) - Lines 342-426 (main descriptor and expanded tags section)

## Testing Checklist

- [ ] Item with short name and descriptor
- [ ] Item with long name that would truncate
- [ ] Item with many spec fields (10+)
- [ ] Item with boolean fields
- [ ] Item with numeric fields
- [ ] Item with no main descriptor (fallback case)
- [ ] Collapsed vs expanded states
- [ ] Hover and click interactions
- [ ] Multiple items in a list
