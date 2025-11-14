// This file is for Render deployment
// It will determine which service to run based on environment variables

const { spawn } = require('child_process');
const path = require('path');

// Determine which service to run based on environment
const service = process.env.SERVICE || 'client';

// Default API URL - you can update this after deployment
const defaultApiUrl = process.env.API_URL || 'http://localhost:5000';
const defaultClientApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

let command, args, cwd;

switch (service) {
  case 'bot':
    command = 'node';
    args = ['index.js'];
    cwd = path.join(__dirname, '..', 'bot', 'Website-Bot-Homework-main');
    break;
  case 'server':
    command = 'node';
    args = ['index.js'];
    cwd = path.join(__dirname, '..', 'server');
    break;
  case 'client':
  default:
    command = 'npm';
    args = ['start'];
    cwd = path.join(__dirname, '..', 'client');
    break;
}

console.log(`Starting ${service} service...`);
console.log(`Command: ${command} ${args.join(' ')}`);
console.log(`Working directory: ${cwd}`);

const child = spawn(command, args, {
  cwd: cwd,
  stdio: 'inherit',
  env: process.env
});

child.on('error', (error) => {
  console.error(`Failed to start ${service} service:`, error);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`${service} service exited with code ${code}`);
  process.exit(code);
});
