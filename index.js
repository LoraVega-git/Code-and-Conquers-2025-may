import * as THREE from "three";
import { OrbitControls } from 'jsm/controls/OrbitControls.js';
import getStarfield from "./src/getStarfield.js";
import { drawThreeGeo } from "./src/threeGeoJSON.js";

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.3);
const camera = new THREE.PerspectiveCamera(75, w / h, 1, 100);
camera.position.z = 5;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredCountry = null;
let hoverTimeout = null;

const geometry = new THREE.SphereGeometry(2);
const lineMat = new THREE.LineBasicMaterial({ 
  color: 0xffffff,
  transparent: true,
  opacity: 0.4, 
});
const edges = new THREE.EdgesGeometry(geometry, 1);
const line = new THREE.LineSegments(edges, lineMat);
scene.add(line);

const stars = getStarfield({ numStars: 1000, fog: false });
scene.add(stars);

const countryMeshes = [];

// Load landmass GeoJSON
fetch('./geojson/ne_110m_land.json')
  .then(response => response.text())
  .then(text => {
    const data = JSON.parse(text);
    const countries = drawThreeGeo({
      json: data,
      radius: 2,
      materialOptions: {
        color: 0x80FF80,
      },
    });
    scene.add(countries);
    countryMeshes.push(...countries.children); // Add country meshes for interaction
  });

// Load country borders GeoJSON
fetch('./geojson/countries_states.geojson')
  .then(response => response.text())
  .then(text => {
    const data = JSON.parse(text);
    const borders = drawThreeGeo({
      json: data,
      radius: 2.01, // Slightly larger radius to avoid z-fighting
      materialOptions: {
        color: 0xFF0000, // Red color for borders
        linewidth: 1,
      },
      line: true, // Render as lines
    });
    scene.add(borders);
  });

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  controls.update();
}

animate();

function handleWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleWindowResize, false);

// Mouse move event
window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(countryMeshes);

  if (intersects.length > 0) {
    const country = intersects[0].object;

    if (hoveredCountry !== country) {
      hoveredCountry = country;

      // Clear any existing timeout
      clearTimeout(hoverTimeout);

      // Set a timeout to zoom in after 5 seconds
      hoverTimeout = setTimeout(() => {
        zoomToCountry(country);
        showCountryInfo(country);
      }, 5000);
    }
  } else {
    hoveredCountry = null;
    clearTimeout(hoverTimeout);
  }
});

// Zoom to country
function zoomToCountry(country) {
  const targetPosition = new THREE.Vector3();
  country.getWorldPosition(targetPosition);

  // Smoothly move the camera to the country's position
  const duration = 1.5; // seconds
  const start = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  const end = { x: targetPosition.x, y: targetPosition.y, z: targetPosition.z + 2 };

  let startTime = null;

  function animateZoom(time) {
    if (!startTime) startTime = time;
    const elapsed = (time - startTime) / 1000;

    if (elapsed < duration) {
      camera.position.x = THREE.MathUtils.lerp(start.x, end.x, elapsed / duration);
      camera.position.y = THREE.MathUtils.lerp(start.y, end.y, elapsed / duration);
      camera.position.z = THREE.MathUtils.lerp(start.z, end.z, elapsed / duration);
      requestAnimationFrame(animateZoom);
    } else {
      camera.position.set(end.x, end.y, end.z);
    }
  }

  requestAnimationFrame(animateZoom);
}

// Show country info in a sidebar
function showCountryInfo(country) {
  const sidebar = document.getElementById('sidebar');
  sidebar.style.display = 'block';
  sidebar.innerHTML = `
    <h2>Country Info</h2>
    <p>Name: ${country.name || 'Unknown'}</p>
    <p>Additional info can go here...</p>
  `;
}

// Button functionality
const zoomInButton = document.getElementById('zoomIn');
const zoomOutButton = document.getElementById('zoomOut');
const resetButton = document.getElementById('reset');

// Zoom In functionality
zoomInButton.addEventListener('click', () => {
  camera.position.z = Math.max(camera.position.z - 0.5, 2); // Prevent zooming too close
});

// Zoom Out functionality
zoomOutButton.addEventListener('click', () => {
  camera.position.z = Math.min(camera.position.z + 0.5, 10); // Prevent zooming too far
});

// Reset functionality
resetButton.addEventListener('click', () => {
  camera.position.set(0, 0, 5); // Reset camera position
  controls.reset(); // Reset OrbitControls
  document.getElementById('sidebar').style.display = 'none'; // Hide sidebar
});