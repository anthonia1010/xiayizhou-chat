import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

let characterPrompt = '';

try {
  const promptFile = join(__dirname, 'character_prompt.txt');
  characterPrompt = readFileSync(promptFile, 'utf-8');
  console.log('Loaded character prompt');
} catch (e) {
  console.log('Using default prompt:', e.message);
}

const API_CONFIGS = {
  openai: {
    baseURL: 'https://api.openai.com/v1/chat/completions',
    authType: 'bearer',
    models: ['gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'gpt-4', 'gpt-4-turbo-preview', 'gpt-4o']
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1/chat/completions',
    authType: 'bearer',
    models: ['deepseek-ai/DeepSeek-V4-Flash', 'deepseek-chat', 'deepseek-r1.5-chat', 'deepseek-r2-chat']
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1/messages',
    authType: 'bearer',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1/models/',
    authType: 'query',
    models: ['gemini-pro', 'gemini-1.5-pro']
  },
  qwen: {
    baseURL: 'https://dashscope.aliyuncs.com/api/text/v1/chat/completions',
    authType: 'bearer',
    models: ['qwen-plus', 'qwen-max', 'qwen-max-longcontext', 'qwen-turbo']
  },
  doubao: {
    baseURL: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/',
    authType: 'query',
    models: ['ernie-3.5', 'ernie-4.0', 'ernie-3.5-8k', 'ernie-speed']
  }
};

function getAPIConfig(model) {
  if (model.startsWith('deepseek')) return API_CONFIGS.deepseek;
  if (model.startsWith('claude')) return API_CONFIGS.anthropic;
  if (model.startsWith('gemini')) return API_CONFIGS.gemini;
  if (model.startsWith('qwen')) return API_CONFIGS.qwen;
  if (model.startsWith('ernie')) return API_CONFIGS.doubao;
  return API_CONFIGS.openai;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, apiKey, model } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const systemMessage = {
      role: 'system',
      content: characterPrompt || '你是一个温柔体贴的角色，请用第一人称回复。'
    };

    const fullMessages = [systemMessage, ...messages];
    const config = getAPIConfig(model || 'deepseek-ai/DeepSeek-V4-Flash');
    
    let url = config.baseURL;
    let requestBody;
    let headers = {
      'Content-Type': 'application/json'
    };

    if (model?.startsWith('claude')) {
      url = 'https://api.anthropic.com/v1/messages';
      requestBody = {
        model: model,
        max_tokens: 500,
        temperature: 0.8,
        messages: fullMessages.slice(1).map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        })),
        system: fullMessages[0].content
      };
      headers['anthropic-version'] = '2023-06-01';
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (model?.startsWith('gemini')) {
      url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
      requestBody = {
        contents: fullMessages.map(m => ({
          role: m.role === 'system' ? 'system' : m.role,
          parts: [{ text: m.content }]
        })),
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 500
        }
      };
    } else if (model?.startsWith('ernie')) {
      url = `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${model}?access_token=${apiKey}`;
      requestBody = {
        messages: fullMessages.map(m => ({
          role: m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        })),
        temperature: 0.8,
        max_tokens: 500
      };
    } else if (model?.startsWith('qwen')) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        model: model,
        messages: fullMessages,
        temperature: 0.8,
        max_tokens: 500
      };
    } else if (model?.startsWith('deepseek')) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        model: model,
        messages: fullMessages,
        temperature: 0.8,
        max_tokens: 500
      };
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        model: model || 'deepseek-ai/DeepSeek-V4-Flash',
        messages: fullMessages,
        temperature: 0.8,
        max_tokens: 500
      };
    }

    console.log(`Calling API: ${url}`);
    console.log(`Model: ${model}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || errorData.message || `API request failed with status ${response.status}`;
      console.error('API Error:', errorMsg);
      throw new Error(errorMsg);
    }

    const data = await response.json();
    let messageContent = '';

    if (model?.startsWith('claude')) {
      messageContent = data.content?.[0]?.text || '';
    } else if (model?.startsWith('gemini')) {
      messageContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (model?.startsWith('ernie')) {
      messageContent = data.result?.content || data.result || '';
    } else {
      messageContent = data.choices?.[0]?.message?.content || '';
    }

    if (!messageContent) {
      throw new Error('Invalid response from API');
    }

    res.json({
      message: messageContent,
      usage: data.usage || data.usage_metadata || null
    });
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/models', (req, res) => {
  const models = [];
  Object.entries(API_CONFIGS).forEach(([provider, config]) => {
    config.models.forEach(model => {
      models.push({
        id: model,
        name: model,
        provider: provider
      });
    });
  });
  res.json(models);
});

app.use(express.static(join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../public', 'index.html'));
});

app.listen(PORT, (err) => {
  if (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
  console.log(`Server running at http://localhost:${PORT}`);
}).on('error', (err) => {
  console.error('Server error:', err.message);
});
