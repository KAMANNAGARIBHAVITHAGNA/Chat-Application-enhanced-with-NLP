const fetch = require("node-fetch");
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_NAME = 'openai/gpt-oss-20b:free';

async function testOpenRouter() {
    console.log('Testing OpenRouter API...');
    console.log('API Key:', OPENROUTER_API_KEY ? 'Found' : 'Missing');
    console.log('Model:', MODEL_NAME);
    
    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:8000',
                'X-Title': 'NLP Chat App'
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    {
                        role: 'user',
                        content: 'Classify the tone of "hello" as one word: Joy, Sadness, Anger, Fear, Confident, Tentative, Analytical, or Neutral. Answer:'
                    }
                ],
                temperature: 0.1,
                max_tokens: 50
            })
        });

        const data = await response.json();
        console.log('\nAPI Response:');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.choices && data.choices.length > 0) {
            console.log('\nDetected tone:', data.choices[0].message.content);
        } else if (data.error) {
            console.log('\nAPI Error:', data.error);
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testOpenRouter();
