from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS, cross_origin
import os
from openai import OpenAI
from mistralai import Mistral
from dotenv import load_dotenv
import json

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

# API configuration
API_PROVIDER = os.getenv("API_PROVIDER", "albert")  # Default to albert if not specified

# Albert (OpenAI) client configuration
albert_base_url = "https://albert.api.etalab.gouv.fr/v1"
albert_api_key = os.getenv("API_KEY")
albert_client = OpenAI(base_url=albert_base_url, api_key=albert_api_key)

# Mistral client configuration
mistral_api_key = os.getenv("MISTRAL_API_KEY")
mistral_client = Mistral(api_key=mistral_api_key)

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
        provider = data.get('provider', API_PROVIDER)

        if provider == "albert":
            response = albert_client.chat.completions.create(
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
        else:  # provider == "mistral"
            if stream:
                response = mistral_client.chat.stream(
                    model="mistral-large-latest",
                    messages=messages
                )
                
                def generate():
                    for chunk in response:
                        if chunk.data.choices[0].delta.content:
                            yield f"data: {chunk.data.choices[0].delta.content}\n\n"
                
                return app.response_class(
                    generate(),
                    mimetype='text/event-stream',
                    headers={
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'text/event-stream'
                    }
                )
            else:
                response = mistral_client.chat.complete(
                    model="mistral-large-latest",
                    messages=messages
                    # ,
                    #   response_format = {
                    #     "type": "json_object"
                    # }
                )
                return jsonify({
                    'content': response.choices[0].message.content,
                    'role': response.choices[0].message.role
                })

    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route('/api/chat-json', methods=['POST'])
@cross_origin(origin='*', headers=['Content-Type', 'Authorization'])
def chat_json():
    try:
        data = request.json
        messages = data.get('messages', [])
        stream = data.get('stream', False)
        provider = "mistral"

        if provider == "albert":
            response = albert_client.chat.completions.create(
                model="neuralmagic/Meta-Llama-3.1-70B-Instruct-FP8",
                messages=messages,
                stream=stream,
                temperature=0.7
            )

            return jsonify({
                'content': response.choices[0].message.content,
                'role': response.choices[0].message.role
            })
           
        else:  # provider == "mistral"
            response = mistral_client.chat.complete(
                model="mistral-large-latest",
                messages=messages,
                temperature=0.5,
                top_p=0.5,
                response_format = {
                    "type": "json_object"
                }
            )
            return jsonify(json.loads(response.choices[0].message.content))

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    


if __name__ == '__main__':
    app.run(debug=True, port=5001)  # Change to unused port