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
let selectedCountry = null;

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
    countries.children.forEach((child) => {
      child.userData = { properties: child.geometry.properties }; // Attach properties to userData
    });
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
    borders.children.forEach((child) => {
      child.userData = { properties: child.geometry.properties }; // Attach properties to userData
    });
    countryMeshes.push(...borders.children); // Add border meshes for interaction
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

// Mouse click event
window.addEventListener('click', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(countryMeshes);

  if (intersects.length > 0) {
    const country = intersects[0].object;

    if (selectedCountry !== country) {
      selectedCountry = country;

      // Center the clicked country on the screen
      centerCountryOnScreen(country);
      showCountryInfo(country);
    }
  }
});

// Center the clicked country on the screen
function centerCountryOnScreen(country) {
  const targetPosition = new THREE.Vector3();
  country.getWorldPosition(targetPosition);

  // Smoothly move the camera to center the country
  const duration = 1.5; // seconds
  const start = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  const end = { x: targetPosition.x * 1.5, y: targetPosition.y * 1.5, z: targetPosition.z * 1.5 };

  let startTime = null;

  function animateCentering(time) {
    if (!startTime) startTime = time;
    const elapsed = (time - startTime) / 1000;

    if (elapsed < duration) {
      camera.position.x = THREE.MathUtils.lerp(start.x, end.x, elapsed / duration);
      camera.position.y = THREE.MathUtils.lerp(start.y, end.y, elapsed / duration);
      camera.position.z = THREE.MathUtils.lerp(start.z, end.z, elapsed / duration);
      controls.target.set(
        THREE.MathUtils.lerp(controls.target.x, targetPosition.x, elapsed / duration),
        THREE.MathUtils.lerp(controls.target.y, targetPosition.y, elapsed / duration),
        THREE.MathUtils.lerp(controls.target.z, targetPosition.z, elapsed / duration)
      );
      controls.update();
      requestAnimationFrame(animateCentering);
    } else {
      camera.position.set(end.x, end.y, end.z);
      controls.target.copy(targetPosition);
      controls.update();
    }
  }

  requestAnimationFrame(animateCentering);
}

// Show country info in a sidebar
function showCountryInfo(country) {
  const sidebar = document.getElementById('sidebar');
  sidebar.style.display = 'block';

  // Extract country properties (e.g., name, type, etc.)
  const properties = country.userData.properties || {};
  const name = properties.name || 'Unknown';
  const type = properties.type || 'Unknown';

  sidebar.innerHTML = `
    <h2>Country Info</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Type:</strong> ${type}</p>
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