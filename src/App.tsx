import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './App.css'

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiUrl = import.meta.env.VITE_API_URL;
  const apiUrlBody = import.meta.env.VITE_API_URL_BODY;
  const apiUrlHead = import.meta.env.VITE_API_URL_HEAD;
  const bearerToken = import.meta.env.VITE_BEARER_TOKEN;

  const [imageUrl, setImageUrl] = useState('');
  const [showButton, setShowButton] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [validationResponse, setValidationResponse] = useState(null);


  interface BodyModel {
    name: string;
    id: string;
    url: string;
  }

  //Handle the upload of the image
  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    let imageUrl = URL.createObjectURL(file);
    setImageUrl(imageUrl);
  };

  function handleFileInputClick() {
    fileInputRef.current?.click();
  }

  useEffect(() => {
    if (imageUrl) {
      renderNewAvatar(imageUrl);
      setShowButton(false);
    }
    // Set up the three.js scene
    const container = containerRef.current!;
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.right = "0";
    container.style.bottom = "0";
    container.style.left = "0";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Add lights to the scene
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 1);
    scene.add(ambientLight, directionalLight);

    //Convert Selfie to Base64
    async function convertToBase64(imageUrl: string): Promise<string> {
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error('Error in the network response.');
        }
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        return new Promise((resolve) => {
          reader.onloadend = () => {
            const base64String = reader.result as string;
            resolve(base64String.split(',')[1]);
          };
        });
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error(`Error converting image to base64: ${error.message}`);
        } else {
          console.error(`An unknown error occurred while converting image to base64: ${error}`);
        }
        throw error;
      }
    }

    // Fetch bodies from API
    async function fetchBodies(): Promise<BodyModel[]> {
      try {
        const response = await fetch(apiUrlBody, {
          headers: {
            'Authorization': `Bearer ${bearerToken}`
          }
        });
        if (!response.ok) {
          throw new Error('Error in the network response.');
        }
        const data = await response.json();
        return data;
      } catch (error: unknown) {
        console.error('Error fetching bodies:', (error as Error).message);
        return [];
      }
    }

    // Call the API to generate the avatar from the selfie image
    async function renderNewAvatar(imageUrl: string) {
      try {
        const bodies = await fetchBodies();
        const ids = bodies.map((body: BodyModel) => body.id);
        const randomIndex = Math.floor(Math.random() * ids.length);
        const randomId = ids[randomIndex];
        const base64String = await convertToBase64(imageUrl);

        setIsLoading(true);
        const selfieValidation = await fetch(apiUrlHead, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            img: base64String
          }),
        });
        // We are letting the user use any type of image.
        /* if (!selfieValidation.ok) {
          throw new Error('Error validating selfie image');
        } */
        const validation = await selfieValidation.json();
        setValidationResponse(validation.detail);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: "test",
            img: base64String,
            body_id: randomId
          }),
        });
        if (!response.ok) {
          throw new Error('Error creating new avatar');
        }
        const data = await response.json();
        setIsLoading(false);
        const loader = new GLTFLoader();
        loader.load(data.avatar_link, (gltf) => {
          scene.add(gltf.scene);
        });
      } catch (error: unknown) {
        console.error('Error rendering new avatar:', (error as Error).message);
      }
    }


    // Add camera controls
    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(0, 2.5, 5);
    controls.target.set(0, 0.9, 0);
    controls.update();

    // Render the scene
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Clean up the scene on unmount
    return () => {
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [imageUrl]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {isLoading ? (
        <div className="container">
          <div className="loader-text-validation">*{validationResponse}</div>
          <div className="loader" style={{ marginTop: '20px' }}></div>
          <div className="loader-text">Generating your avatar... (Generating an avatar takes about 30 seconds.)</div>
        </div>
      ) : (
        <>
          {showButton && (
            <div className='container'>
              <button className='main-button' onClick={handleFileInputClick}>
                Upload Image
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileInputChange} style={{ display: "none" }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}


export default App;



