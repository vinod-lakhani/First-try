#!/bin/bash

# Test against production deployment
# This is often more reliable than local dev server

echo "🧪 Running tests against PRODUCTION deployment..."
echo "📡 API URL: https://weleap-mvp.vercel.app"
echo ""

API_URL=https://weleap-mvp.vercel.app node scripts/test-comprehensive.js

