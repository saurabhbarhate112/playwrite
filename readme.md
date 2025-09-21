# Playwright HTML to PNG API

A robust, production-ready API service for converting HTML to PNG images using Playwright, specifically designed for deployment on Render and integration with n8n.

## Features

- 🚀 **High Performance**: Uses Playwright with Chromium for reliable rendering
- 🛡️ **Security**: Built-in rate limiting, CORS, and security headers
- 📱 **Responsive**: Customizable viewport sizes and full-page screenshots
- 🔧 **Flexible**: Support for custom CSS, JavaScript, and wait conditions
- 🐳 **Docker Ready**: Containerized for consistent deployment
- 💪 **Production Ready**: Error handling, health checks, and graceful shutdown

## Quick Start

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd playwright-html-to-png-api
npm install
```

### 2. Local Development

```bash
# Install Playwright browsers
npx playwright install --with-deps chromium

# Start development server
npm run dev
```

### 3. Deploy to Render

1. Connect your GitHub repository to Render
2. Use the provided `render.yaml` configuration
3. Deploy as a Docker service

## API Endpoints

### Health Check
```
GET /health
```

Returns service health status and browser connection info.

### Convert HTML to PNG
```
POST /convert
```

**Request Body:**
```json
{
  "html": "<html><body><h1>Hello World</h1></body></html>",
  "width": 1280,
  "height": 720,
  "fullPage": false,
  "quality": 100,
  "format": "png",
  "waitFor": null,
  "css": "",
  "javascript": "",
  "timeout": 30000
}
```

**Parameters:**

- `html` (required): HTML content to convert
- `width` (optional, default: 1280): Viewport width in pixels
- `height` (optional, default: 720): Viewport height in pixels  
- `fullPage` (optional, default: false): Capture full page or viewport only
- `quality` (optional, default: 100): Image quality (1-100, JPEG only)
- `format` (optional, default: "png"): Output format ("png" or "jpeg")
- `waitFor` (optional): Wait condition before screenshot:
  - Number: Wait for milliseconds
  - "selector:CSS_SELECTOR": Wait for element to appear
- `css` (optional): Additional CSS to inject
- `javascript` (optional): JavaScript code to execute
- `timeout` (optional, default: 30000): Request timeout in milliseconds

**Response:**
Returns the generated PNG/JPEG image as binary data.

## Using with n8n

### HTTP Request Node Configuration

1. **Method**: POST
2. **URL**: `https://your-render-app.onrender.com/convert`
3. **Body**: JSON with your HTML and options
4. **Headers**: 
   - `Content-Type: application/json`

### Example n8n Workflow

```json
{
  "method": "POST",
  "url": "https://your-app-name.onrender.com/convert",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "html": "{{ $json.htmlContent }}",
    "width": 1920,
    "height": 1080,
    "fullPage": true,
    "format": "png"
  }
}
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
NODE_ENV=production
PORT=3000
RATE_LIMIT_MAX=200
ALLOWED_ORIGINS=https://your-n8n-instance.com
```

## Error Handling

The API provides detailed error responses:

- `400`: Bad Request (missing HTML, invalid dimensions)
- `408`: Request Timeout (page load timeout)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

## Performance Optimization

- Browser instance is reused across requests
- Automatic page cleanup after each conversion
- Compression enabled for API responses
- Memory-efficient Docker image

## Security Features

- Rate limiting (100 requests per 15 minutes by default)
- CORS configuration
- Security headers (helmet.js)
- Input validation and sanitization
- Non-root Docker container

## Troubleshooting

### Common Issues

1. **Browser fails to start on Render**
   - Ensure you're using the Docker deployment method
   - All required system dependencies are included in Dockerfile

2. **Out of memory errors**
   - Upgrade to a higher Render plan
   - Reduce concurrent requests using rate limiting

3. **Timeout errors**
   - Increase the `timeout` parameter
   - Optimize your HTML/CSS for faster rendering

4. **CORS errors in n8n**
   - Set `ALLOWED_ORIGINS` to your n8n instance URL
   - Or use `*` for development (not recommended for production)

### Logs and Monitoring

Check Render logs for:
- Browser initialization status
- Request processing details
- Error messages and stack traces

## Development

### Local Testing

```bash
# Test the API
curl -X POST http://localhost:3000/convert \
  -H "Content-Type: application/json" \
  -d '{"html":"<h1>Test</h1>","width":800,"height":600}' \
  --output test.png
```

### Docker Testing

```bash
# Build and run locally
docker build -t playwright-api .
docker run -p 3000:3000 playwright-api
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Render deployment logs
3. Create an issue in the repository