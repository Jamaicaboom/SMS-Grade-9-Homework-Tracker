#!/bin/bash

# SMS Grade 9 Homework Tracker - Development Startup Script
# This script helps start all services for local development

echo "🚀 Starting SMS Grade 9 Homework Tracker Development Environment"
echo "================================================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use"
        return 1
    else
        echo "✅ Port $1 is available"
        return 0
    fi
}

# Check required ports
echo ""
echo "🔍 Checking required ports..."
check_port 5000  # Backend server
check_port 3000  # Frontend development server

echo ""
echo "📁 Setting up backend server..."
cd server

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from example..."
    cp env.example .env
    echo "📝 Please edit .env file with your configuration before continuing"
    echo "   Required: MONGO_URI, DISCORD_WEBHOOK_URL"
    read -p "Press Enter when you've configured .env file..."
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

echo "🚀 Starting backend server on port 5000..."
npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

echo ""
echo "📁 Setting up frontend client..."
cd ../client

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local file not found. Creating from example..."
    cp env.local.example .env.local
    echo "✅ Created .env.local with local development settings"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

echo "🚀 Starting frontend development server on port 3000..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "🎉 Development environment started!"
echo "=================================="
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:5000"
echo "📊 API Health: http://localhost:5000/health"
echo ""
echo "🛑 To stop all services, press Ctrl+C"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait
