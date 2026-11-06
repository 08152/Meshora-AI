import os
import time
import threading

import numpy as np
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder=".", static_url_path="")

training_state = {
    "running": False,
    "progress": 0,
    "trained": False,
    "last_training": None
}

training_lock = threading.Lock()


@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "training": training_state
    })


@app.route("/train", methods=["POST"])
def train():
    data = request.get_json(silent=True) or {}
    epochs = int(data.get("epochs", 50))
    epochs = max(1, min(1000, epochs))

    with training_lock:
        if training_state["running"]:
            return jsonify({"error": "Training läuft bereits."}), 409

        training_state["running"] = True
        training_state["progress"] = 0

    def run_demo_training():
        try:
            rng = np.random.default_rng(42)

            # Kleines experimentelles Demo-Modell.
            # Es lernt einfache synthetische Formmerkmale,
            # keine realistischen 3D-Modelle.
            samples = rng.normal(size=(300, 3))
            labels = np.zeros((300, 3), dtype=np.float32)

            for index in range(300):
                labels[index] = [
                    abs(samples[index, 0]),
                    abs(samples[index, 1]),
                    abs(samples[index, 2])
                ]

            weights = rng.normal(0, 0.1, (3, 3))
            learning_rate = 0.001

            for epoch in range(epochs):
                prediction = samples @ weights
                error = prediction - labels
                gradient = (samples.T @ error) / len(samples)
                weights -= learning_rate * gradient

                training_state["progress"] = int(
                    ((epoch + 1) / epochs) * 100
                )

                time.sleep(0.02)

            os.makedirs("model_data", exist_ok=True)
            np.save("model_data/demo_weights.npy", weights)

            training_state["trained"] = True
            training_state["last_training"] = time.time()

        except Exception as error:
            print("Training error:", error)

        finally:
            training_state["running"] = False

    threading.Thread(target=run_demo_training, daemon=True).start()

    return jsonify({
        "message": "Demo-Training wurde gestartet.",
        "epochs": epochs
    })


@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json(silent=True) or {}

    prompt = str(data.get("prompt", ""))[:500]
    shape = str(data.get("shape", "cube")).lower()
    color = str(data.get("color", "#ff7138"))

    allowed_shapes = {
        "cube",
        "sphere",
        "cylinder",
        "cone",
        "torus"
    }

    if shape not in allowed_shapes:
        shape = "cube"

    if not (
        len(color) == 7
        and color.startswith("#")
        and all(c in "0123456789abcdefABCDEF" for c in color[1:])
    ):
        color = "#ff7138"

    return jsonify({
        "success": True,
        "shape": shape,
        "color": color,
        "prompt": prompt,
        "trained_demo": training_state["trained"],
        "message": "Primitive 3D-Demo erstellt."
    })


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Seite nicht gefunden."}), 404


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 10000))
    )
