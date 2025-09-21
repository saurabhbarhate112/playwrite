const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global browser instance
let browser = null;

// Initialize browser
async function initBrowser() {
  try {
    if (!browser) {
      console.log('Launching browser...');
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows'
        ]
      });
      console.log('Browser launched successfully');
    }
    return browser;
  } catch (error) {
    console.error('Failed to launch browser:', error);
    throw error;
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Playwright HTML to PNG API is running',
    version: '1.0.0',
    endpoints: {
      health: 'GET /',
      convert: 'POST /convert'
    }
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const browserInstance = await initBrowser();
    const isHealthy = browserInstance && !browserInstance.isConnected() === false;
    
    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      browser: isHealthy ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Convert HTML to PNG endpoint
app.post('/convert', async (req, res) => {
  let page = null;
  
  try {
    const {
      html,
      width = 1280,
      height = 720,
      fullPage = false,
      quality = 100,
      format = 'png',
      waitFor = null,
      css = '',
      javascript = '',
      timeout = 30000
    } = req.body;

    // Validation
    if (!html) {
      return res.status(400).json({
        error: 'HTML content is required',
        message: 'Please provide HTML content in the request body'
      });
    }

    if (width > 3840 || height > 2160) {
      return res.status(400).json({
        error: 'Dimensions too large',
        message: 'Maximum dimensions are 3840x2160'
      });
    }

    // Initialize browser
    const browserInstance = await initBrowser();
    page = await browserInstance.newPage();

    // Set viewport
    await page.setViewportSize({ width: parseInt(width), height: parseInt(height) });

    // Add custom CSS if provided
    if (css) {
      await page.addStyleTag({ content: css });
    }

    // Set content with timeout
    await page.setContent(html, {
      waitUntil: 'networkidle',
      timeout: parseInt(timeout)
    });

    // Execute custom JavaScript if provided
    if (javascript) {
      await page.evaluate(javascript);
    }

    // Wait for specific element or time if specified
    if (waitFor) {
      if (typeof waitFor === 'string' && waitFor.includes('selector:')) {
        const selector = waitFor.replace('selector:', '');
        await page.waitForSelector(selector, { timeout: parseInt(timeout) });
      } else if (typeof waitFor === 'number' || !isNaN(parseInt(waitFor))) {
        await page.waitForTimeout(parseInt(waitFor));
      }
    }

    // Take screenshot
    const screenshotOptions = {
      type: format,
      fullPage: fullPage,
      quality: format === 'jpeg' ? parseInt(quality) : undefined
    };

    const screenshot = await page.screenshot(screenshotOptions);

    // Set appropriate headers
    res.set({
      'Content-Type': `image/${format}`,
      'Content-Length': screenshot.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Send screenshot
    res.send(screenshot);

  } catch (error) {
    console.error('Conversion error:', error);
    
    // Handle specific errors
    let statusCode = 500;
    let errorMessage = 'Internal server error during conversion';
    
    if (error.message.includes('timeout')) {
      statusCode = 408;
      errorMessage = 'Request timeout - page took too long to load';
    } else if (error.message.includes('net::ERR_')) {
      statusCode = 400;
      errorMessage = 'Network error loading resources';
    } else if (error.message.includes('Protocol error')) {
      statusCode = 500;
      errorMessage = 'Browser protocol error';
    }

    res.status(statusCode).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  } finally {
    // Always close the page
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        console.error('Error closing page:', closeError);
      }
    }
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'Please check the API documentation',
    availableEndpoints: {
      health: 'GET /',
      convert: 'POST /convert'
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Playwright HTML to PNG API server is running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Convert endpoint: POST http://localhost:${PORT}/convert`);
});

// Initialize browser on startup
initBrowser().catch(error => {
  console.error('Failed to initialize browser on startup:', error);
});