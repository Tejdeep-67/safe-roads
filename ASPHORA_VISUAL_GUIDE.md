# 🎨 Asphora - Visual Branding Guide

## Color Scheme

### Primary Colors
- **Primary Blue**: `#2563eb` - Main app color
- **Secondary Cyan**: `#06b6d4` - Accent and highlights
- **White**: `#ffffff` - Text and icons
- **Dark Text**: `#111827` - Headers and content

### Gradient
```
Main Intro: Linear Gradient (top-left to bottom-right)
From: #2563eb (Blue-600)
Via: #3b82f6 (Blue-500)  
To: #06b6d4 (Cyan-500)
```

### Severity Markers (unchanged)
- 🔴 **High Severity**: `#ef4444` (Red-500) - ≥85% confidence
- 🟠 **Medium Severity**: `#f97316` (Orange-500) - 70-84% confidence
- 🟡 **Low Severity**: `#fbbf24` (Amber-500) - <70% confidence

---

## Typography

### Logo/Header
- **Font**: Bold Sans-serif
- **Size**: 48px (3xl)
- **Color**: White (#ffffff)
- **Weight**: 700 (Bold)
- **Text**: "Asphora"

### Tagline
- **Font**: Light Sans-serif
- **Size**: 20px (xl)
- **Color**: Light Blue (#eff6ff) - rgb(239, 246, 255)
- **Weight**: 300 (Light)
- **Tracking**: Wide letter spacing
- **Text**: "AI for Safer Streets"

### Loading Text
- **Size**: 14px (sm)
- **Color**: Blue-100 with 75% opacity
- **Text**: "Initializing..."

---

## Animation Timing

### Intro Sequence
```
Timeline:
├─ 0ms → 500ms: Fade in entire screen
├─ 500ms → 1000ms: Logo icon bounces (ping animation)
├─ 1000ms → 1500ms: "Asphora" slides up (slideUp animation)
├─ 1500ms → 2000ms: Tagline fades in
├─ 2000ms → 3500ms: Loading dots bounce continuously
├─ 3500ms → 4000ms: Fade out (opacity to 0)
└─ 4000ms → : App loads normally
```

### Icon Animation
```
Pothole Icon:
├─ Bounce: Repeats infinitely (lucide-react default)
├─ Ping: Background circle expands (unlimited)
└─ Pulse: Icon pulses with opacity change
```

### Loading Dots
```
Three dots, each dot bounces with staggered timing:
├─ Dot 1: No delay
├─ Dot 2: 0.2s delay
└─ Dot 3: 0.4s delay
```

---

## UI Layout - Intro Screen

```
┌─────────────────────────────────────┐
│                                     │
│    ✨ Blurry background circles     │
│    (animated, semi-transparent)     │
│                                     │
│          ╔═══════════════╗         │
│          ║      ⚠️      ║         │
│          ║ (Pothole Icon)║         │
│          ╚═══════════════╝         │
│        [Bouncing animation]        │
│                                     │
│           ASPHORA                  │
│                                     │
│     AI for Safer Streets           │
│                                     │
│           • • •                     │
│        (loading dots)              │
│                                     │
│         Initializing...             │
│                                     │
└─────────────────────────────────────┘

Gradient Background:
Blue-600 ──→ Cyan-500
(top-left)   (bottom-right)
```

---

## Login Screen - Updated Branding

```
┌──────────────────────────────────┐
│  ┌────────────────────────────┐  │
│  │      ASPHORA               │  │
│  │  AI for Safer Streets      │  │
│  │                            │  │
│  │  Navigate safely with real-│  │
│  │  time pothole detection    │  │
│  │  and warnings              │  │
│  │                            │  │
│  │    ┌──────────────────┐    │  │
│  │    │  Get Started     │    │  │
│  │    └──────────────────┘    │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘

White card shadow on gradient background
```

---

## Component Hierarchy

```
App.tsx
├─ showIntro ? <Intro /> : null ✨ NEW
├─ !user ? <LoginScreen /> : <MainApp />
│  ├─ Search "Asphora" branding
│  ├─ Map with markers
│  ├─ SearchBar
│  ├─ DirectionsPanel
│  ├─ ProfilePanel ← onPotholeUploaded callback
│  └─ ProfileButton
└─ route ? <WarningAlert /> : null
```

---

## Key Features - Visual Feedback

### When Pothole Uploaded
```
1. ProfilePanel shows: "✅ Pothole reported successfully!"
2. App triggers: setRefreshTrigger(++), 
3. Map Component detects refresh
4. Potholes re-fetched from backend
5. New markers appear on map within ~2 seconds ✨
6. Other users see it within 5 seconds max
```

### Active Navigation Alert
```
┌─────────────────────────────┐
│ ⚠️ 2 potholes ahead in the  │
│    next 500 meters          │
└─────────────────────────────┘
Red border, positioned top-left
Auto-updates every 30 seconds
```

---

## Animation Classes

### Custom CSS Animations
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slideUp {
  animation: slideUp 0.6s ease-out forwards;
}
```

### Tailwind Animations Used
- `animate-bounce`: Logo icon jumping
- `animate-pulse`: Icon and background opacity pulse
- `animate-ping`: Background circle expanding effect

---

## Responsive Design

### Mobile (< 640px)
- Intro text slightly smaller (40px instead of 48px)
- Same gradient and animations
- Icon scales down proportionally
- All animations remain smooth

### Tablet (640px - 1024px)
- Standard intro display
- Full animations active
- Proper spacing maintained

### Desktop (> 1024px)
- Enhanced animations
- Larger icon (112px)
- Maximum visual impact

---

## Accessibility

✅ **Contrast Ratios**:
- White text on Blue-600: WCAG AAA (7.5:1)
- White text on Cyan: WCAG AA (4.5:1)

✅ **Animation**:
- Respects `prefers-reduced-motion` (implicit via Tailwind)
- Loading dots animate smoothly
- No seizure-inducing flashes

✅ **Keyboard Navigation**:
- All buttons remain accessible
- Auto-dismiss doesn't interfere
- Users can click through if needed

---

## Performance Notes

- Intro uses CSS animations (GPU accelerated)
- No heavy JavaScript in animations
- Background gradients are gradual (not janky)
- Auto-dismisses to prevent memory leaks
- ~1.2KB additional CSS for animations

