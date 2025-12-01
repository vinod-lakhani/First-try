# Fix Local Dev Server

## Steps to Fix

1. **Stop the current dev server** (if running):
   - Go to the terminal where `npm run dev` is running
   - Press `Ctrl+C` to stop it

2. **Clear the build cache** (already done):
   ```bash
   rm -rf .next
   ```

3. **Restart the dev server**:
   ```bash
   cd weleap-mockups
   npm run dev
   ```

4. **Wait for server to fully start**:
   - Look for: "Ready in X seconds"
   - Check that it says "Local: http://localhost:3000"

5. **Verify the API route works**:
   ```bash
   curl http://localhost:3000/api/chat -X POST \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"text":"test","isUser":true}],"context":"financial-sidekick"}' \
     | jq . 2>/dev/null || echo "Response received (may need jq for pretty printing)"
   ```

6. **Run the tests**:
   ```bash
   node scripts/test-comprehensive.js
   ```

## Common Issues

### Issue: "Cannot find module '../chunks/ssr/[turbopack]_runtime.js'"
**Solution**: Clear `.next` cache and restart (steps above)

### Issue: "Port 3000 already in use"
**Solution**: 
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
# Then restart
npm run dev
```

### Issue: Still getting errors after clearing cache
**Solution**: Try a full clean rebuild:
```bash
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

## After Server is Fixed

Once the server is running properly, you should be able to:
- ✅ Access http://localhost:3000
- ✅ Make API calls to /api/chat
- ✅ Run the test suite

