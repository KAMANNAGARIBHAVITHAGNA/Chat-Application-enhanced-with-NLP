const fetch = require("node-fetch");
require('dotenv').config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

async function testAPI() {
    console.log('Testing Google Gemini API...');
    console.log('API Key:', GOOGLE_API_KEY ? 'Found' : 'Missing');
    
    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: 'Reply with only one word: Joy, Sadness, Anger, Fear, Confident, Tentative, or Analytical. What is the tone of: "hello"'
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 100,
                    responseModalities: ["TEXT"]
                },
                systemInstruction: {
                    parts: [{
                        text: "You are a tone analyzer. Always respond with exactly one word from the list provided."
                    }]
                }
            })
        });

        const data = await response.json();
        console.log('\nAPI Response:');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.candidates && data.candidates.length > 0) {
            console.log('\nExtracted tone:', data.candidates[0].content.parts[0].text);
        } else if (data.error) {
            console.log('\nAPI Error:', data.error);
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testAPI();
