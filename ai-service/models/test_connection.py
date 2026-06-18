import ollama

models = [
    "qwen3:8b",
    "deepseek-r1:8b",
    "llama3.1:8b",
    "llama3.2:3b"
]

for model in models:
    print(f"Testing {model}...")
    response = ollama.chat(
        model=model,
        messages=[{"role": "user", "content": "say hello in one word"}]
    )
    print(f"Response: {response['message']['content']}")
    print("---")
    print("Hello");