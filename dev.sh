#!/bin/bash
export NODE_OPTIONS="--max-old-space-size=1024"
export VITE_TELEMETRY_DISABLED=1
exec npm run dev
