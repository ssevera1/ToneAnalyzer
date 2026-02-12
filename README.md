# ToneAnalyzer

Cross-platform voice stress analysis (CVSA) and multi-video emotion detection application built with React, Electron, and Capacitor.

## Features

### Voice Stress Analysis (CVSA)
- Real-time microphone capture or audio file upload
- Microtremor analysis (8–14 Hz band) — stress suppresses muscle microtremors
- Fundamental frequency (F0) tracking via autocorrelation pitch detection
- Jitter (cycle-to-cycle pitch perturbation)
- Shimmer (cycle-to-cycle amplitude perturbation)
- Harmonic-to-Noise Ratio (HNR)
- Composite stress score (0–100) with weighted metrics
- Live waveform and scrolling spectrogram visualizations
- Circular stress gauge with color-coded severity levels
- Session recording with full reading history

### Multi-Video Emotion Detection
- Monitor up to 12 simultaneous video feeds
- Source types: webcam, screen capture, video file, RTSP/IP camera (Electron)
- Real-time face detection via TinyFaceDetector (face-api.js)
- 7 base emotions: neutral, happy, sad, angry, fearful, disgusted, surprised
- Bounding box overlays with emotion badges on each detected face
- Configurable grid layouts: 1, 2×2, 2×3, 3×3, 3×4
- Round-robin processing across feeds for GPU efficiency

### Derived Expression Labels (50+)
Each video panel displays derived behavioral labels at the bottom, computed from base emotion combinations and temporal patterns:

| Category | Examples |
|---|---|
| **Deception** | Duping Delight, Emotion Masking, Emotional Incongruence, Squelched Expression, Expression Freeze, Held Expression, Rapid Onset |
| **Contempt / Hostility** | Contempt, Smugness, Defiance, Hatred, Resentment, Indignation, Exasperation, Schadenfreude |
| **Fear / Stress** | Apprehension, Anxiety, Alarm, Horror, Arousal Spike, Elevated Stress, Sustained Tension |
| **Sadness** | Disappointment, Guilt, Shame, Resignation, Nostalgia, Bittersweet, Pity |
| **Social / Evaluative** | Embarrassment, Envy, Jealousy, Suspicion, Skepticism, Confusion, Interest, Boredom, Apathy |
| **Positive** | Relief, Anticipation, Adoration, Awe |
| **Behavioral** | Determination, Submission, Dominance, Frustration, Emotional Volatility, Expression Dampening, Baseline Comfort, Genuine Engagement |

Labels are color-coded by category and show confidence percentages. Deception indicators are highlighted with red borders.

### Data Export
- CSV export with full metric columns for voice or emotion sessions
- PDF report generation with summary statistics and data tables
- Session persistence via IndexedDB (Dexie.js)

### Cross-Platform
- **Web**: Runs in any modern browser
- **Desktop**: Electron packaging for Windows and macOS
- **Mobile**: Capacitor for iOS (camera/mic permissions, 4-feed limit)

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18, TypeScript, Tailwind CSS |
| Build | Vite |
| State | Zustand |
| Audio | Web Audio API (AnalyserNode + AudioWorklet) |
| Face/Emotion | TensorFlow.js, @vladmandic/face-api |
| Charts | Recharts |
| Storage | IndexedDB via Dexie.js |
| Export | jsPDF, PapaParse |
| Desktop | Electron |
| Mobile | Capacitor |

## Getting Started

### Prerequisites
- Node.js 20+
- npm 9+

### Install & Run

```bash
git clone https://github.com/ssevera1/ToneAnalyzer.git
cd ToneAnalyzer
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Electron (Desktop)

```bash
npm run electron:dev    # Dev mode with hot reload
npm run electron:build  # Package for Windows/macOS
```

### iOS (Capacitor)

```bash
npm run build
npm run ios:sync
npm run ios:open        # Opens Xcode
```

## Project Structure

```
src/
├── components/          # Shared UI components
│   ├── Layout.tsx       # Dark theme shell + sidebar
│   ├── Sidebar.tsx      # Navigation sidebar
│   ├── StressGauge.tsx  # Circular SVG gauge (0-100)
│   ├── Waveform.tsx     # Real-time waveform canvas
│   ├── Spectrogram.tsx  # Scrolling spectrogram canvas
│   ├── VideoPanel.tsx   # Video feed + emotion overlay + expression labels
│   ├── VideoGrid.tsx    # Grid of 1-12 VideoPanel components
│   ├── EmotionBadge.tsx # Emotion label pill
│   ├── ExpressionLabels.tsx  # Derived expression label bar
│   └── ExportDialog.tsx # CSV/PDF export modal
├── features/
│   ├── voice-analysis/
│   │   ├── AudioEngine.ts       # Web Audio API capture + FFT
│   │   ├── StressAnalyzer.ts    # CVSA algorithms
│   │   ├── VoiceAnalysisPage.tsx
│   │   └── useVoiceAnalysis.ts
│   ├── emotion-detection/
│   │   ├── EmotionEngine.ts     # face-api.js wrapper
│   │   ├── ExpressionAnalyzer.ts # 50+ derived expression rules
│   │   ├── VideoSourceManager.ts
│   │   ├── EmotionMonitorPage.tsx
│   │   └── useEmotionDetection.ts
│   └── settings/
│       └── SettingsPage.tsx
├── services/
│   ├── database.ts      # Dexie.js IndexedDB schema
│   ├── exportService.ts # CSV/PDF generation
│   └── platformUtils.ts # Platform detection
├── stores/              # Zustand state stores
│   ├── appStore.ts
│   ├── voiceStore.ts
│   └── emotionStore.ts
└── types/               # TypeScript interfaces
    ├── audio.ts
    ├── emotion.ts
    └── video.ts
electron/
├── main.ts              # Electron main process
├── preload.ts           # IPC bridge
└── rtsp-proxy.ts        # RTSP→WebSocket relay
```

## Deploying to a Web Server

ToneAnalyzer is a static single-page app. After building, the `dist/` folder can be served from any web server or cloud provider.

> **Important:** Microphone and camera access require HTTPS in production. All deployment methods below include HTTPS configuration.

### Build for Production

```bash
npm run build
```

This outputs static files to `dist/`. That folder is everything you need to deploy.

### Option 1: AWS (S3 + CloudFront)

**Using the AWS CLI:**

```bash
# 1. Create an S3 bucket
aws s3 mb s3://tone-analyzer-app

# 2. Upload the build
aws s3 sync dist/ s3://tone-analyzer-app --delete

# 3. Enable static website hosting
aws s3 website s3://tone-analyzer-app \
  --index-document index.html \
  --error-document index.html

# 4. Set bucket policy for public read access
aws s3api put-bucket-policy --bucket tone-analyzer-app --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicRead",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::tone-analyzer-app/*"
  }]
}'
```

**Add CloudFront for HTTPS (required for mic/camera):**

```bash
# 5. Create a CloudFront distribution pointing to the S3 website endpoint
aws cloudfront create-distribution \
  --origin-domain-name tone-analyzer-app.s3-website-us-east-1.amazonaws.com \
  --default-root-object index.html
```

Or use the AWS Console:
1. Go to **CloudFront** → **Create Distribution**
2. Set origin to your S3 bucket website endpoint
3. Set **Viewer Protocol Policy** to "Redirect HTTP to HTTPS"
4. Set **Default Root Object** to `index.html`
5. Under **Error Pages**, add a custom error response: 403/404 → `/index.html` (status 200) — this enables client-side routing

Your app will be available at the CloudFront URL (e.g., `https://d1234abcd.cloudfront.net`).

**Using AWS Amplify (simpler alternative):**

```bash
# One-command deploy with Amplify
npm install -g @aws-amplify/cli
amplify init
amplify add hosting
amplify publish
```

Or connect your GitHub repo directly in the [AWS Amplify Console](https://console.aws.amazon.com/amplify/) for automatic deploys on every push.

### Option 2: AWS EC2 with Nginx

```bash
# 1. Launch an EC2 instance (Amazon Linux 2 / Ubuntu)
# 2. SSH into the instance and install dependencies
sudo yum install -y nginx       # Amazon Linux
# or
sudo apt install -y nginx       # Ubuntu

# 3. Clone and build
git clone https://github.com/ssevera1/ToneAnalyzer.git
cd ToneAnalyzer
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs      # or sudo yum install -y nodejs
npm install
npm run build

# 4. Copy build to Nginx web root
sudo cp -r dist/* /usr/share/nginx/html/

# 5. Configure Nginx for SPA routing
# Replace your-domain.com with your domain, or use _ to match any hostname (works with just an IP)
sudo tee /etc/nginx/conf.d/toneanalyzer.conf > /dev/null <<'NGINX'
server {
    listen 80;
    server_name your-domain.com;  # use _ if you only have an IP address
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Cache model files
    location /models/ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
NGINX

# 6. Remove the default Nginx site (avoids conflicts when using server_name _)
sudo rm -f /etc/nginx/sites-enabled/default

# 7. Restart Nginx
sudo systemctl restart nginx

# The app is now accessible at http://<your-ec2-ip>
# Note: Mic/camera access requires HTTPS (see below).

# 8. Add HTTPS (required for mic/camera in production)
#
# Option A — You have a domain name pointed at this server:
sudo apt install -y certbot python3-certbot-nginx   # Ubuntu
sudo certbot --nginx -d your-domain.com
#
# Option B — IP address only (no domain):
# Let's Encrypt does not issue certificates for bare IP addresses.
# Use a self-signed certificate instead:
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/toneanalyzer.key \
  -out /etc/ssl/certs/toneanalyzer.crt \
  -subj "/CN=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
# Then add these lines inside the server block in toneanalyzer.conf:
#   listen 443 ssl;
#   ssl_certificate     /etc/ssl/certs/toneanalyzer.crt;
#   ssl_certificate_key /etc/ssl/private/toneanalyzer.key;
# Restart Nginx: sudo systemctl restart nginx
# Access at https://<your-ec2-ip> (your browser will warn about the self-signed cert — accept it)
```

### Option 3: Personal Server (Nginx)

Works on any Linux server, VPS, Raspberry Pi, or home server.

```bash
# 1. Install Node.js and Nginx
sudo apt update && sudo apt install -y nginx nodejs npm

# 2. Clone and build
git clone https://github.com/ssevera1/ToneAnalyzer.git
cd ToneAnalyzer
npm install
npm run build

# 3. Deploy to Nginx
sudo mkdir -p /var/www/toneanalyzer
sudo cp -r dist/* /var/www/toneanalyzer/

# 4. Create Nginx site config
sudo tee /etc/nginx/sites-available/toneanalyzer > /dev/null <<'NGINX'
server {
    listen 80;
    server_name your-domain.com;   # or your server IP
    root /var/www/toneanalyzer;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /models/ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
NGINX

# 5. Enable the site
sudo ln -sf /etc/nginx/sites-available/toneanalyzer /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 6. Add HTTPS with Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Option 4: Personal Server (Simple — No Nginx)

For quick testing or LAN-only use:

```bash
# Serve the build with Vite's preview server
npm run build
npm run preview -- --host 0.0.0.0 --port 8080

# Or use any static file server
npx serve dist -l 8080
```

Access from other devices on your network at `http://<your-ip>:8080`.

> Note: Without HTTPS, browsers will block microphone/camera access unless the page is served from `localhost`. For LAN use with mic/camera, set up a self-signed certificate or use a reverse proxy with Let's Encrypt.

### Option 5: Docker

```dockerfile
# Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY <<'NGINX' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
docker build -t toneanalyzer .
docker run -p 8080:80 toneanalyzer
```

For AWS, push the image to ECR and deploy to ECS, App Runner, or Lightsail Containers.

### Deployment Notes

- **HTTPS is required** for `getUserMedia` (microphone/camera) in production. Only `localhost` is exempt.
- **Model files** (~520 KB total) are served from `/models/`. Ensure your server/CDN serves `.bin` files with the correct MIME type (`application/octet-stream`).
- The app is fully client-side — there is no backend server needed. All processing (audio analysis, face detection) runs in the browser.
- For RTSP/IP camera support, use the Electron desktop build instead of the web deployment.

## Stress Score Calculation

The composite stress score is a weighted combination:

| Metric | Weight | Stress Indicator |
|---|---|---|
| Microtremor amplitude | 30% | Lower = more stress (inverted) |
| F0 variance | 25% | Higher = more stress |
| Jitter | 20% | Higher = more stress |
| Shimmer | 15% | Higher = more stress |
| HNR | 10% | Lower = more stress (inverted) |

## License

MIT
