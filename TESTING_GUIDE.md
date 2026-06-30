# 🧪 Asphora - Testing & Verification Guide

## ✅ Feature Verification Checklist

### Intro Screen Animation
- [ ] **Launch App**: Open browser → http://localhost:5174
- [ ] **See Intro**: Beautiful blue-cyan gradient screen appears immediately
- [ ] **Logo Bounces**: Pothole icon in white circle bounces with pulse effect
- [ ] **Text Animates**: "ASPHORA" slides up smoothly
- [ ] **Tagline Fades**: "AI for Safer Streets" appears gracefully
- [ ] **Loading Dots**: Three dots bounce with staggered timing
- [ ] **Auto-closes**: Intro fades out after 3.5 seconds
- [ ] **Smooth Transition**: App smoothly transitions to login screen
- [ ] **No Jank**: Animations are smooth, 60fps

### Login Screen Branding  
- [ ] **Header**: "Asphora" displayed prominently
- [ ] **Tagline Visible**: "AI for Safer Streets" shown below name
- [ ] **Colors Match**: Blue gradient background consistent with intro
- [ ] **Button Works**: "Get Started" button fully functional
- [ ] **Professional Look**: Overall aesthetic is polished

### Pothole Visibility Fix - Single User
1. **Open terminal & navigate to backend**:
   ```bash
   cd project/backend
   python app.py  # or appropriate startup command
   ```

2. **Start MongoDB** (if local):
   ```bash
   mongod
   ```

3. **Login to app** in browser

4. **Upload test pothole**:
   - Click Profile icon (top-right)
   - Switch to "Report Pothole" tab
   - Upload any image (with fake GPS if needed)
   - See: ✅ Success message
   - Click "My Reports" → see report listed

5. **Verify on map**:
   - Search destination → Get directions
   - Start navigation
   - Check map for pothole markers
   - Should see the uploaded pothole

### Pothole Visibility Fix - Multiple Users
**This is the key test!**

1. **Open TWO browser windows** (or two machines):
   ```
   Window A: http://localhost:5174 (User 1)
   Window B: http://localhost:5174 (User 2 - different login)
   ```

2. **Setup navigation in both**:
   - Both sign in
   - Both search same destination
   - Both click "Get Directions" → "Start Navigation"
   - Both should see map with route

3. **Upload pothole in Window A**:
   - User A: Click Profile → "Report Pothole"
   - Upload image
   - See: ✅ Success message

4. **Verify visibility in Window B**:
   - ⏱️ Watch map in Window B
   - **Expected**: Within 2-5 seconds, pothole appears on Window B's map
   - ✅ **Success**: If visible on both maps
   - ❌ **Failure**: If only visible in Window A

### Periodic Refresh Verification
1. **Open browser console**: Press F12 → Console tab

2. **Upload pothole in Window A**

3. **Watch Window B's network tab**: 
   - Look for API calls to `/api/potholes`
   - Should see call immediately after upload
   - Then see calls every 30 seconds

4. **Expected Network Pattern**:
   ```
   [Immediate] POST /api/potholes/on-route
   [+30s] GET /api/potholes/on-route
   [+60s] GET /api/potholes/on-route
   [Upload] POST /api/potholes/on-route (on-demand)
   ```

### Warning Message Verification
1. **Upload multiple potholes** (if possible)

2. **Ensure they're on route**:
   - Potholes within 30m of route should appear
   - Should see warning message:
     ```
     ⚠️ X potholes ahead in the next Y km
     ```

3. **Update route**: 
   - Search different destination
   - Upload pothole near new route
   - Warning should update automatically

---

## 🐛 Troubleshooting

### Intro doesn't show
- **Check**: Make sure `showIntro` state is initialized to `true` in App.tsx
- **Fix**: Verify `<Intro onComplete={() => setShowIntro(false)} />` is rendered
- **Clear Cache**: Ctrl+Shift+Delete cache, reload

### Pothole not visible on second machine
- **Check Backend**: Ensure MongoDB is running
- **Check API**: Open DevTools → Network → verify `/api/potholes` returns data
- **Test API directly**: 
  ```bash
  curl http://localhost:5000/api/potholes
  ```
- **Verify Verified Status**: Check MongoDB that pothole has `verified: true`

### Animations stuttering
- **Check GPU**: Open DevTools → Performance → record during intro
- **Expected**: 60 FPS throughout
- **Fix**: Disable browser extensions, try incognito mode

### RefreshTrigger not working
- **Check Console**: Look for any JavaScript errors
- **Verify State**: Add console.log in useEffect to see refresh trigger fire
- **Code Check**: Ensure refreshTrigger is passed to Map component

---

## 📊 Performance Metrics

### Expected Performance
- Intro load time: < 100ms
- Intro animation: 60 FPS smooth
- Pothole refresh: < 1 second (network dependent)
- Map re-render: < 500ms

### Network Monitoring
With DevTools open:
- Intro load: 0 KB (CSS animations only)
- Single pothole fetch: ~2-5 KB response
- Map redraw: < 100ms

---

## 🎯 Test Cases

### Test Case 1: Fresh Install
```
Scenario: First time user launches app
Steps:
1. Open http://localhost:5174
2. Watch intro animation
3. Wait for auto-dismiss
4. See login screen

Expected:
- Intro plays smoothly
- Auto-dismisses at 3.5s
- No JavaScript errors
- Login screen visible
```

### Test Case 2: Pothole Upload
```
Scenario: User uploads pothole image
Steps:
1. Login
2. Search destination
3. Get directions
4. Upload pothole
5. Check map

Expected:
- Success message shown
- Pothole appears on map
- Can be deleted
- Persists after refresh
```

### Test Case 3: Multi-User Pothole Sync
```
Scenario: Two users see same pothole
Steps:
1. Open Window A & B, both login
2. Window A: Upload pothole
3. Window B: Monitor map

Expected:
- Pothole appears in Window B within 5s
- Both users see same pothole
- Data persists
```

### Test Case 4: Periodic Refresh
```
Scenario: Automatic refresh every 30s
Steps:
1. Open DevTools → Network
2. Navigate on map
3. Watch for API calls
4. Wait 30 seconds
5. Record calls

Expected:
- API calls every 30s
- Multiple `/api/potholes` calls
- All responses successful (200)
```

### Test Case 5: Route Update
```
Scenario: Change route, potholes update
Steps:
1. Start navigation (Route A)
2. Upload pothole near Route A
3. See pothole on Route A
4. Change to Route B (no pothole nearby)
5. Pothole should NOT show

Expected:
- Only relevant potholes shown
- Intelligent filtering works
- Buffer zone respected (30m)
```

---

## 🚨 Critical Tests Before Deployment

1. ✅ **Test with 2 simultaneous users**
2. ✅ **Verify MongoDB persistence**
3. ✅ **Check network timeouts** (simulate slow connection)
4. ✅ **Monitor memory usage** during long sessions
5. ✅ **Verify intro timing** (should be exactly 3.5s)
6. ✅ **Test on mobile** (responsive design)
7. ✅ **Clear browser cache** and retry
8. ✅ **Verify no console errors**

---

## 📈 Success Criteria

### Intro Screen
- ✅ Animations smooth and professional
- ✅ Auto-dismisses properly
- ✅ No JavaScript errors
- ✅ Branding clear and visible
- ✅ Timing consistent (3.5 seconds)

### Pothole Visibility
- ✅ Potholes appear in under 5 seconds on other machines
- ✅ Periodic refresh every 30 seconds confirmed
- ✅ Route filtering works correctly
- ✅ Multiple users see same potholes
- ✅ No data loss on refresh

### Overall UX
- ✅ Professional appearance
- ✅ Fast responsiveness
- ✅ Reliable data synchronization
- ✅ Clear user feedback
- ✅ No crashes or errors

