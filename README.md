# sofos

![](https://github.com/alexylon/Sofos/actions/workflows/node.js.yml/badge.svg)

A multimodal AI chatbot built with the Vercel AI SDK, React (TypeScript), Next.js, NextAuth.js, and Material UI. 

It can read incoming messages, convert speech to text, and analyze multiple images at the same time.

Supports OpenAI, Anthropic, and Google models and their API keys.

<br/>

<div align="center"><img align="center" src="/public/images/sofos_screenshot.png" width="400" alt="Sofos"></div>

<br/>

## RUN the App in a browser

### Install Node v.22

### Copy `.env.local.template` as `.env.local` and fill in the following values:

`OPENAI_API_KEY` - go to https://platform.openai.com/account/api-keys

`ANTHROPIC_API_KEY` - go to https://docs.anthropic.com/en/api/getting-started

`GOOGLE_GENERATIVE_AI_API_KEY` - go to https://aistudio.google.com/apikey

`GITHUB_ID` - go to GitHub -> Settings -> Developer Settings -> OAuth Apps -> New OAuth App

`GITHUB_SECRET` - go to GitHub -> Settings -> Developer Settings -> OAuth Apps -> New OAuth App

`NEXTAUTH_SECRET` - generate a random string

Currently, there is no database support.

### Run the following commands in the `root` directory:

```npm install```

```npm run dev```

Then navigate to http://localhost:3000 in your browser

## BUILD the app as a Docker image, run it as a Docker container and push it to your Docker Hub repository

1. Navigate to the project's root directory (where the `dockerfile` and `.env.local` reside).

2. Assuming Docker is installed, build the Docker image:

```bash
  docker build -t docker-username/docker-hub-repository:tag .
```

3. Once the image has been built, run the container, assign it a name and map app host's port 3333 to the container's port 3333:

```bash
  docker run -d -p 3333:3333 --name sofos-docker --env-file .env.local docker-username/docker-hub-repository:tag
```

4. Open your browser and navigate to http://localhost:3333.

If you need hot reloading for development, remember to mount your working directory as a volume:

```bash
  docker run -p 3333:3333 --name sofos-docker -v "$(pwd):/app" --env-file .env.local docker-username/docker-hub-repository:tag
```

5. Push the image to your Docker Hub repository

```bash
  docker push docker-username/docker-hub-repository:tag
```
