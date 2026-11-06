import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/exporters/GLTFExporter.js";

const viewer = document.getElementById("viewer");
const generateButton = document.getElementById("generate");
const exportButton = document.getElementById("export");
const statusElement = document.getElementById("status");
const promptElement = document.getElementById("prompt");
const shapeElement = document.getElementById("shape");
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");

if (viewer) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101722);

    const camera = new THREE.PerspectiveCamera(
        45,
        viewer.clientWidth / viewer.clientHeight,
        0.1,
        100
    );

    camera.position.set(4, 3, 5);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(viewer.clientWidth, viewer.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    viewer.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x30384a, 2));

    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(4, 6, 5);
    scene.add(light);

    const grid = new THREE.GridHelper(10, 20, 0x536174, 0x273141);
    scene.add(grid);

    let currentModel = null;
    let selectedImageColor = "#ff7138";

    function createGeometry(type) {
        switch (type) {
            case "sphere":
                return new THREE.SphereGeometry(1, 48, 32);
            case "cylinder":
                return new THREE.CylinderGeometry(0.7, 0.7, 1.8, 32);
            case "cone":
                return new THREE.ConeGeometry(1, 2, 32);
            case "torus":
                return new THREE.TorusGeometry(0.8, 0.3, 20, 64);
            default:
                return new THREE.BoxGeometry(1.7, 1.7, 1.7, 2, 2, 2);
        }
    }

    function guessShape(description) {
        const value = description.toLowerCase();

        if (value.includes("kugel") || value.includes("ball")) return "sphere";
        if (value.includes("zylinder") || value.includes("säule")) return "cylinder";
        if (value.includes("kegel")) return "cone";
        if (value.includes("ring")) return "torus";
        return "cube";
    }

    function createModel(type, color) {
        if (currentModel) {
            scene.remove(currentModel);
            currentModel.geometry.dispose();
            currentModel.material.dispose();
        }

        const geometry = createGeometry(type);
        const material = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.65,
            metalness: 0.12
        });

        currentModel = new THREE.Mesh(geometry, material);
        currentModel.position.y = 1;
        currentModel.castShadow = true;
        currentModel.receiveShadow = true;
        scene.add(currentModel);
    }

    async function generate() {
        if (!generateButton) return;

        const prompt = promptElement?.value.trim() || "";
        let type = shapeElement?.value || "auto";

        if (type === "auto") {
            type = guessShape(prompt);
        }

        generateButton.disabled = true;
        statusElement.textContent = "Erstelle Vorschau ...";

        try {
            const response = await fetch("/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    shape: type,
                    color: selectedImageColor
                })
            });

            if (!response.ok) {
                throw new Error("Serverfehler: " + response.status);
            }

            const data = await response.json();
            createModel(data.shape || type, data.color || selectedImageColor);
            statusElement.textContent =
                "Vorschau erstellt. Dies ist derzeit eine primitive 3D-Demo, keine vollständige KI-Modellgenerierung.";
        } catch (error) {
            createModel(type, selectedImageColor);
            statusElement.textContent =
                "Server nicht erreichbar. Lokale 3D-Vorschau erstellt.";
        } finally {
            generateButton.disabled = false;
        }
    }

    generateButton?.addEventListener("click", generate);

    imageInput?.addEventListener("change", () => {
        const file = imageInput.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        imagePreview.src = url;
        imagePreview.style.display = "block";

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 1;
            canvas.height = 1;

            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0, 1, 1);

            const pixel = context.getImageData(0, 0, 1, 1).data;
            selectedImageColor =
                "#" +
                [pixel[0], pixel[1], pixel[2]]
                    .map(value => value.toString(16).padStart(2, "0"))
                    .join("");

            statusElement.textContent =
                "Bild geladen. Die aktuelle Demo verwendet die durchschnittliche Bildfarbe.";
        };

        image.src = url;
    });

    exportButton?.addEventListener("click", () => {
        if (!currentModel) {
            statusElement.textContent = "Erstelle zuerst ein Modell.";
            return;
        }

        const exporter = new GLTFExporter();

        exporter.parse(
            currentModel,
            result => {
                const blob = new Blob([result], {
                    type: "model/gltf-binary"
                });

                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "risky-3d-model.glb";
                link.click();

                URL.revokeObjectURL(url);
            },
            error => {
                statusElement.textContent = "Export fehlgeschlagen: " + error.message;
            },
            { binary: true }
        );
    });

    function resize() {
        const width = viewer.clientWidth;
        const height = viewer.clientHeight;

        if (!width || !height) return;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    new ResizeObserver(resize).observe(viewer);

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }

    animate();
}
