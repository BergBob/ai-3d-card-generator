# AI 3D Card Generator

Generate unique, 3D-printable greeting cards from AI-generated images. Describe what you want, pick an AI image provider, and the app turns your idea into a printable STL or 3MF file -- ready for your 3D printer.

<img width="2121" height="1414" alt="Xnapper-2026-03-23-07 52 16" src="https://github.com/user-attachments/assets/4d98d6bb-2991-4c72-b0f3-1ada4d1b7de3" />

## Features

- Text-to-image generation with multiple AI providers
- Automatic image-to-vector conversion using Potrace
- Real-time 3D preview with Three.js
- Configurable card dimensions, border, and relief depth
- Export to STL and 3MF file formats
- Project save and load support
- Settings UI for managing API keys in the browser

## How It Works

1. **AI Image Generation** -- Describe your card motif and the app generates an image via your chosen AI provider.
2. **Potrace Vectorization** -- The image is converted to high-contrast black and white, then traced into vector paths.
3. **3D Mesh Construction** -- Vector paths are extruded into a relief on a configurable card base.
4. **Export** -- Download the result as an STL or 3MF file, ready for slicing and 3D printing.

## Supported AI Providers

| Provider | Environment Variable |
|---|---|
| [OpenRouter](https://openrouter.ai/) (Gemini Flash / Pro) | `OPENROUTER_API_KEY` |
| [OpenAI DALL-E 3](https://platform.openai.com/) | `OPENAI_API_KEY` |
| [Stability AI](https://stability.ai/) | `STABILITY_API_KEY` |
| [Google Imagen](https://ai.google.dev/) | `GOOGLE_AI_API_KEY` |

You only need a key for the provider(s) you want to use. Keys can also be entered at runtime through the in-app Settings dialog.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- npm

## Quick Start

### Easy Start (Double-Click)

No terminal needed! Just double-click the start file for your operating system:

| OS | File | How to use |
|---|---|---|
| **macOS** | `start.command` | Double-click in Finder |
| **Windows** | `start.bat` | Double-click in Explorer |
| **Linux** | `start.sh` | Double-click in file manager (or run `./start.sh`) |

The start file will:
- ✅ Check that Node.js is installed
- 📦 Install dependencies automatically (first run only)
- 🚀 Start the server
- 🌐 Open the app in your browser

### Manual Start (Terminal)

```bash
# Clone the repository
git clone https://github.com/BergBob/ai-3d-card-generator.git
cd ai-3d-card-generator

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173` (Vite dev server). The backend API runs on the port specified in `.env` (default `3001`).

### API Key Setup

You can add API keys in two ways:
1. **In the app** -- Click the ⚙ Settings icon in the top right corner
2. **Via .env file** -- Copy `.env.example` to `.env` and add your keys

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start client and server in development mode |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

## Tech Stack

- **Frontend:** React, TypeScript, Three.js, Vite
- **Backend:** Express, Node.js
- **Image Processing:** Sharp, Potrace
- **3D Export:** Custom STL/3MF generators with earcut triangulation

## License

This project is licensed under the [MIT License](LICENSE).
