# AI 3D Card Generator

Generate unique, 3D-printable greeting cards from AI-generated images. Describe what you want, pick an AI image provider, and the app turns your idea into a printable STL or 3MF file -- ready for your 3D printer.

<img width="2121" height="1414" alt="image" src="https://github.com/user-attachments/assets/e93be7db-cba0-407b-96c8-abf2f3f648bf" />

## Features

- Text-to-image generation powered by Google Gemini
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

| Provider | Models | Environment Variable |
|---|---|---|
| [OpenRouter](https://openrouter.ai/) | Gemini 2.5 Flash, 3 Pro, 3.1 Flash | `OPENROUTER_API_KEY` |
| [Google AI Studio](https://aistudio.google.com/) | Gemini 2.5 Flash | `GOOGLE_AI_API_KEY` |

You only need a key for one of the two providers. Keys can be entered at runtime through the in-app Settings dialog (click the gear icon).

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
