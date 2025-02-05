from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS, cross_origin
import os
from tts.tts import synthesize
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


app = Flask(__name__, static_url_path='/static')
# Configure CORS to allow all origins with proper headers
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "allow_headers": ["Content-Type", "Authorization"],
        "methods": ["POST", "OPTIONS"]
    }
})

# OpenAI client configuration
base_url = "https://albert.api.etalab.gouv.fr/v1"
api_key = os.getenv("API_KEY")
client = OpenAI(base_url=base_url, api_key=api_key)

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/chat', methods=['POST'])
@cross_origin(origin='*', headers=['Content-Type', 'Authorization'])
def chat():
    try:
        data = request.json
        messages = data.get('messages', [])
        stream = data.get('stream', False)

        response = client.chat.completions.create(
            model="neuralmagic/Meta-Llama-3.1-70B-Instruct-FP8",
            messages=messages,
            stream=stream,
            temperature=0.7
        )

        if not stream:
            return jsonify({
                'content': response.choices[0].message.content,
                'role': response.choices[0].message.role
            })
        else:
            def generate():
                for chunk in response:
                    if chunk.choices[0].finish_reason is not None:
                        break
                    if chunk.choices[0].delta.content:
                        yield f"data: {chunk.choices[0].delta.content}\n\n"
            
            return app.response_class(
                generate(),
                mimetype='text/event-stream',
                headers={
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'text/event-stream'
                }
            )

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route("/api/tts", methods=["POST"])
def app_synthesize() -> bytes:
    text = request.data.decode("utf-8")
    text = text.strip()
    return synthesize(text)


if __name__ == '__main__':
    app.run(debug=True, port=5001)  # Change to unused port