#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

if [ ! -f ".env.local" ]; then
    print_error ".env.local file not found. Exiting."
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    print_status "Docker is not running. Starting Docker Desktop..."
    open -a Docker
    print_status "Waiting for Docker to start..."
    while ! docker info > /dev/null 2>&1; do
        sleep 2
    done
    print_success "Docker is now running"
fi

print_status "Starting Sofos deployment process..."

print_status "Checking for existing 'sofos' container..."
if docker ps -a --format "table {{.Names}}" | grep -q "^sofos$"; then
    print_status "Stopping existing 'sofos' container..."
    docker stop sofos > /dev/null 2>&1
    print_status "Removing existing 'sofos' container..."
    docker rm sofos > /dev/null 2>&1
    print_success "Existing container removed"
else
    print_status "No existing 'sofos' container found"
fi

print_status "Checking for existing 'innoxius/sofos:latest' image..."
if docker images --format "table {{.Repository}}:{{.Tag}}" | grep -q "^innoxius/sofos:latest$"; then
    print_status "Removing existing 'innoxius/sofos:latest' image..."
    docker rmi innoxius/sofos:latest > /dev/null 2>&1
    print_success "Existing image removed"
else
    print_status "No existing 'innoxius/sofos:latest' image found"
fi

print_status "Building new Docker image 'innoxius/sofos:latest'..."
if docker build -q -t innoxius/sofos:latest .; then
    print_success "Docker image built successfully"
else
    print_error "Failed to build Docker image"
    exit 1
fi

# The container is reached only by cloudflared, over a private Docker network
# the two share, so nothing is published to the LAN: a port on 0.0.0.0 would be
# a way into this app that skips Cloudflare Access entirely.
if ! docker network inspect tunnel > /dev/null 2>&1; then
    print_status "Creating the 'tunnel' network..."
    docker network create tunnel > /dev/null
fi

print_status "Starting new 'sofos' container..."
# HOSTNAME=0.0.0.0 is required: Next.js binds to $HOSTNAME, which Docker sets to
# the container id, and that resolves to one interface only — cloudflared then
# cannot reach it from the shared network.
if docker run -d --network tunnel -e HOSTNAME=0.0.0.0 --name sofos --restart unless-stopped --env-file .env.local innoxius/sofos:latest; then
    print_success "Container started successfully"
    print_success "Sofos is now running at https://ai.zaxo.io (via the Cloudflare tunnel)"
else
    print_error "Failed to start container"
    exit 1
fi

print_status "Deployment completed successfully!"

echo ""
print_status "Container Status:"
docker ps --filter "name=sofos" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
