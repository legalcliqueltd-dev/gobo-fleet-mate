

## Fix: Driver Dashboard Map Not Visible + Layout Overflow

**Root cause**: In a CSS flex column, children with `flex-1` default to `min-height: auto`, which prevents them from shrinking below their content size. The Google Map container has `height: 100%` but its parent chain never resolves to an actual pixel height — it collapses to 0.

**Fix** (3 files):

### 1. `src/components/layout/DriverAppLayout.tsx` (line 60)
Change `<main>` to include `min-h-0`:
```
<main className="flex-1 min-h-0 overflow-hidden">
```

### 2. `src/pages/app/DriverAppDashboard.tsx` (lines 419-420)
Add `min-h-0` to the flex containers so the map can inherit a real height:
```
<div className="relative h-full w-full flex flex-col min-h-0">
  <div className="flex-1 relative min-h-0">
```
Remove `flex-1` from the outer div (it already has `h-full`).

### 3. `src/components/layout/DriverAppLayout.tsx` (line 27)
Change root container from `min-h-screen` to `h-screen` to give a fixed height for the flex chain:
```
<div className="h-screen bg-background flex flex-col overflow-hidden">
```

**Why this works**: `h-screen` on root gives a concrete height. `min-h-0` on each flex child allows it to shrink. `height: 100%` on the map then resolves to actual pixels instead of collapsing.

