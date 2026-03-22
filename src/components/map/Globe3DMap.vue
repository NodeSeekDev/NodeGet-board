<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useI18n } from "vue-i18n";
import { useThemeStore } from "@/stores/theme";
import { MAP_THEME } from "@/components/map/theme";

type MapPoint = {
  name: string;
  region: string;
  count: number;
  nodes: string[];
  value: [number, number, number];
};

type UserLocation = {
  name: string;
  value: [number, number, number];
};

type GeoJsonGeometry = {
  type: string;
  coordinates: any;
};

type GeoJsonFeature = {
  geometry: GeoJsonGeometry;
};

type GeoJson = {
  features?: GeoJsonFeature[];
};

const props = defineProps<{
  points: MapPoint[];
  userLocation?: UserLocation | null;
}>();
const { t } = useI18n();
const themeStore = useThemeStore();

const rootEl = ref<HTMLDivElement | null>(null);
const loading = ref(true);
const loadError = ref("");
const tooltip = ref<{
  visible: boolean;
  x: number;
  y: number;
  title: string;
  count: number;
  nodes: string[];
}>({
  visible: false,
  x: 0,
  y: 0,
  title: "",
  count: 0,
  nodes: [],
});

const WORLD_MAP_URL = `${import.meta.env.BASE_URL}geo/world.json`;

let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let controls: OrbitControls | null = null;
let earthMesh: THREE.Mesh | null = null;
let markerGroup: THREE.Group | null = null;
let routeGroup: THREE.Group | null = null;
let resizeObserver: ResizeObserver | null = null;
let frameId = 0;
let earthTexture: THREE.CanvasTexture | null = null;
let glowTexture: THREE.CanvasTexture | null = null;
let lastSignature = "";
let atmosphereMesh: THREE.Mesh | null = null;
let starfield: THREE.Points | null = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredMarker: THREE.Group | null = null;

const themeMode = computed(() =>
  themeStore.isDark ? MAP_THEME.dark : MAP_THEME.light,
);
const themePalette = computed(() => themeMode.value.globe);

const shellClass = computed(() => themeMode.value.shellBorderClass);

const frameClass = computed(() => themeMode.value.frameClass);

const overlayClass = computed(() => themeMode.value.overlayClass);

const tooltipPanelClass = computed(() => themeMode.value.tooltipPanelClass);

const tooltipMetaClass = computed(() => themeMode.value.tooltipMetaClass);

const tooltipListClass = computed(() => themeMode.value.tooltipListClass);

function getStateSignature(
  points: MapPoint[],
  userLocation?: UserLocation | null,
) {
  return JSON.stringify({
    points: points.map((point) => ({
      region: point.region,
      count: point.count,
      value: point.value,
      nodes: [...point.nodes].sort(),
    })),
    userLocation: userLocation ?? null,
  });
}

function projectTexturePoint(
  lon: number,
  lat: number,
  width: number,
  height: number,
) {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return [x, y] as const;
}

function drawPolygonRing(
  ctx: CanvasRenderingContext2D,
  ring: [number, number][],
  width: number,
  height: number,
) {
  for (let i = 0; i < ring.length; i++) {
    const point = ring[i];
    if (!point) continue;
    const [x, y] = projectTexturePoint(point[0], point[1], width, height);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function buildEarthTextureCanvas(geoJson: GeoJson) {
  const canvas = document.createElement("canvas");
  canvas.width = 4096;
  canvas.height = 2048;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const { width, height } = canvas;

  const colors = themePalette.value;
  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, colors.oceanTop);
  ocean.addColorStop(0.4, colors.oceanMidTop);
  ocean.addColorStop(0.72, colors.oceanMidBottom);
  ocean.addColorStop(1, colors.oceanBottom);
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  const bloom = ctx.createRadialGradient(
    width * 0.28,
    height * 0.28,
    0,
    width * 0.28,
    height * 0.28,
    width * 0.46,
  );
  bloom.addColorStop(0, colors.bloom);
  bloom.addColorStop(1, colors.bloomFade);
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = colors.gridLine;
  ctx.lineWidth = 0.8;
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, y] = projectTexturePoint(0, lat, width, height);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let lon = -150; lon <= 180; lon += 30) {
    const [x] = projectTexturePoint(lon, 0, width, height);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = colors.landFill;
  ctx.strokeStyle = colors.landStroke;
  ctx.lineWidth = 1.35;

  for (const feature of geoJson.features ?? []) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    ctx.beginPath();
    if (geometry.type === "Polygon") {
      for (const ring of geometry.coordinates as [number, number][][]) {
        drawPolygonRing(ctx, ring, width, height);
      }
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates as [number, number][][][]) {
        for (const ring of polygon) {
          drawPolygonRing(ctx, ring, width, height);
        }
      }
    }
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = colors.speckles;
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 2.4 + 0.4;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return canvas;
}

function buildGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const glowColor = themePalette.value.glowTextureRgb;
  const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.18, `rgba(${glowColor}, 0.92)`);
  gradient.addColorStop(0.55, `rgba(${glowColor}, 0.24)`);
  gradient.addColorStop(1, `rgba(${glowColor}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return canvas;
}

function buildStarfield() {
  const geometry = new THREE.BufferGeometry();
  const starCount = 1200;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const radius = 12 + Math.random() * 14;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const sinPhi = Math.sin(phi);
    positions[i * 3] = radius * sinPhi * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta);
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: themePalette.value.starColor,
    size: 0.05,
    transparent: true,
    opacity: themePalette.value.starOpacity,
    sizeAttenuation: true,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

function lonLatToVector3(lon: number, lat: number, radius: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function clearMarkerGroup() {
  if (!markerGroup || !scene) return;
  scene.remove(markerGroup);
  markerGroup.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material))
        child.material.forEach((m: THREE.Material) => m.dispose());
      else child.material.dispose();
    }
    if (child instanceof THREE.Sprite) {
      if (Array.isArray(child.material))
        child.material.forEach((m: THREE.Material) => m.dispose());
      else child.material.dispose();
    }
  });
  markerGroup.clear();
  markerGroup = null;
}

function clearRouteGroup() {
  if (!routeGroup || !scene) return;
  scene.remove(routeGroup);
  routeGroup.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      if (Array.isArray(child.material))
        child.material.forEach((m: THREE.Material) => m.dispose());
      else child.material.dispose();
    }
    if (child instanceof THREE.Sprite) {
      if (Array.isArray(child.material))
        child.material.forEach((m: THREE.Material) => m.dispose());
      else child.material.dispose();
    }
  });
  routeGroup.clear();
  routeGroup = null;
}

function hideTooltip() {
  tooltip.value.visible = false;
}

function setMarkerHoverState(marker: THREE.Group | null, hovered: boolean) {
  if (!marker) return;
  const colors = themePalette.value;

  const glow = marker.userData.glow as THREE.Sprite | undefined;
  const core = marker.userData.core as THREE.Mesh | undefined;
  const baseScale = (marker.userData.baseScale as number | undefined) ?? 1;

  marker.scale.setScalar(hovered ? baseScale * 1.18 : baseScale);

  const glowMaterial = glow?.material;
  if (glowMaterial && !Array.isArray(glowMaterial)) {
    const material = glowMaterial as THREE.SpriteMaterial;
    material.opacity = hovered ? 1 : 0.9;
    material.color.set(hovered ? colors.markerGlowHover : colors.markerGlow);
  }

  const coreMaterial = core?.material;
  if (coreMaterial && !Array.isArray(coreMaterial)) {
    const material = coreMaterial as THREE.MeshBasicMaterial;
    material.color.set(hovered ? colors.markerCoreHover : colors.markerCore);
  }
}

function rebuildMarkers() {
  if (!scene) return;
  const colors = themePalette.value;

  clearMarkerGroup();
  markerGroup = new THREE.Group();
  scene.add(markerGroup);

  const radius = 1.72;

  for (const point of props.points) {
    const position = lonLatToVector3(point.value[0], point.value[1], radius);
    const marker = new THREE.Group();
    marker.userData = {
      region: point.region || point.name,
      count: point.count,
      nodes: point.nodes,
    };
    marker.position.copy(position);
    marker.lookAt(position.clone().multiplyScalar(2));

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: colors.markerGlow,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    const baseSize = 0.09 + Math.min(point.count * 0.018, 0.1);
    glow.scale.setScalar(baseSize * 2.2);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(baseSize * 0.35, 20, 20),
      new THREE.MeshBasicMaterial({
        color: colors.markerCore,
      }),
    );

    marker.userData.glow = glow;
    marker.userData.core = core;
    marker.userData.baseScale = 1;
    marker.add(glow);
    marker.add(core);
    markerGroup.add(marker);
  }
}

function rebuildRoutes() {
  if (!scene) return;
  const colors = themePalette.value;

  clearRouteGroup();

  if (!props.userLocation) return;

  routeGroup = new THREE.Group();
  scene.add(routeGroup);

  const radius = 1.72;
  const userPosition = lonLatToVector3(
    props.userLocation.value[0],
    props.userLocation.value[1],
    radius + 0.045,
  );

  const userGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: colors.userGlow,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      depthTest: false,
    }),
  );
  userGlow.position.copy(userPosition);
  userGlow.scale.setScalar(0.32);
  userGlow.renderOrder = 12;
  routeGroup.add(userGlow);

  const userCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 20, 20),
    new THREE.MeshBasicMaterial({
      color: colors.userCore,
      depthTest: false,
    }),
  );
  userCore.position.copy(userPosition);
  userCore.renderOrder = 13;
  routeGroup.add(userCore);

  for (const point of props.points) {
    const targetPosition = lonLatToVector3(
      point.value[0],
      point.value[1],
      radius + 0.028,
    );
    const distance = userPosition.distanceTo(targetPosition);
    const arcHeight = Math.min(1.18, 0.46 + distance * 0.16);
    const controlPoint = userPosition
      .clone()
      .add(targetPosition)
      .multiplyScalar(0.5)
      .normalize()
      .multiplyScalar(radius + arcHeight);
    const curve = new THREE.QuadraticBezierCurve3(
      userPosition,
      controlPoint,
      targetPosition,
    );
    const pointsOnCurve = curve.getPoints(72);
    const geometry = new THREE.BufferGeometry().setFromPoints(pointsOnCurve);
    const material = new THREE.LineBasicMaterial({
      color: colors.routeColor,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 11;
    routeGroup.add(line);
  }
}

function handlePointerMove(event: PointerEvent) {
  if (!renderer || !camera || !markerGroup) return;

  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObjects(markerGroup.children, true);
  const hit = intersects.find((item) => item.object.parent?.userData?.region);

  if (!hit) {
    if (hoveredMarker) {
      setMarkerHoverState(hoveredMarker, false);
      hoveredMarker = null;
    }
    hideTooltip();
    if (rootEl.value) rootEl.value.style.cursor = "grab";
    return;
  }

  const marker = hit.object.parent as THREE.Group | null;
  if (hoveredMarker !== marker) {
    if (hoveredMarker) setMarkerHoverState(hoveredMarker, false);
    hoveredMarker = marker;
    if (hoveredMarker) setMarkerHoverState(hoveredMarker, true);
  }

  const data = marker?.userData as
    | { region: string; count: number; nodes: string[] }
    | undefined;

  if (!data) {
    hideTooltip();
    return;
  }

  if (rootEl.value) rootEl.value.style.cursor = "pointer";
  tooltip.value = {
    visible: true,
    x: event.clientX - rect.left + 14,
    y: event.clientY - rect.top + 14,
    title: data.region,
    count: data.count,
    nodes: data.nodes,
  };
}

function resizeRenderer() {
  if (!rootEl.value || !renderer || !camera) return;
  const width = rootEl.value.clientWidth;
  const height = rootEl.value.clientHeight;
  if (width === 0 || height === 0) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  frameId = window.requestAnimationFrame(animate);
  controls?.update();
  if (scene && camera && renderer) renderer.render(scene, camera);
}

function destroyScene() {
  if (frameId) {
    window.cancelAnimationFrame(frameId);
    frameId = 0;
  }
  resizeObserver?.disconnect();
  resizeObserver = null;
  controls?.dispose();
  clearMarkerGroup();
  clearRouteGroup();
  hoveredMarker = null;
  hideTooltip();

  if (earthMesh) {
    earthMesh.geometry.dispose();
    if (Array.isArray(earthMesh.material))
      earthMesh.material.forEach((m: THREE.Material) => m.dispose());
    else earthMesh.material.dispose();
  }

  earthTexture?.dispose();
  glowTexture?.dispose();
  if (atmosphereMesh) {
    atmosphereMesh.geometry.dispose();
    if (Array.isArray(atmosphereMesh.material))
      atmosphereMesh.material.forEach((m: THREE.Material) => m.dispose());
    else atmosphereMesh.material.dispose();
  }
  if (starfield) {
    starfield.geometry.dispose();
    if (Array.isArray(starfield.material))
      starfield.material.forEach((m: THREE.Material) => m.dispose());
    else starfield.material.dispose();
  }

  renderer?.domElement.removeEventListener("pointermove", handlePointerMove);
  renderer?.domElement.removeEventListener("pointerleave", hideTooltip);
  renderer?.dispose();

  if (renderer?.domElement.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  scene = null;
  camera = null;
  renderer = null;
  controls = null;
  earthMesh = null;
  atmosphereMesh = null;
  starfield = null;
  markerGroup = null;
  routeGroup = null;
  earthTexture = null;
  glowTexture = null;
}

async function initScene() {
  if (!rootEl.value) return;

  try {
    loading.value = true;
    loadError.value = "";

    const geoJson = (await fetch(WORLD_MAP_URL).then((response) => {
      if (!response.ok) {
        throw new Error(`failed to load world map: ${response.status}`);
      }
      return response.json();
    })) as GeoJson;

    const colors = themePalette.value;
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(colors.fogColor, colors.fogDensity);
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.02, 7.8);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rootEl.value.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.48;
    controls.minDistance = 4.6;
    controls.maxDistance = 9.2;
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", hideTooltip);

    const ambient = new THREE.AmbientLight(0xffffff, colors.ambientIntensity);
    const hemisphere = new THREE.HemisphereLight(
      colors.hemisphereSky,
      colors.hemisphereGround,
      0.95,
    );
    const directional = new THREE.DirectionalLight(0xffffff, 0.54);
    directional.position.set(4, 3, 5);
    scene.add(ambient, hemisphere, directional);

    starfield = buildStarfield();
    scene.add(starfield);

    earthTexture = new THREE.CanvasTexture(buildEarthTextureCanvas(geoJson));
    earthTexture.colorSpace = THREE.SRGBColorSpace;
    earthTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    glowTexture = new THREE.CanvasTexture(buildGlowTexture());
    glowTexture.colorSpace = THREE.SRGBColorSpace;

    earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 96, 96),
      new THREE.MeshStandardMaterial({
        map: earthTexture,
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.05,
      }),
    );
    scene.add(earthMesh);

    atmosphereMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.77, 96, 96),
      new THREE.MeshBasicMaterial({
        color: colors.atmosphereColor,
        transparent: true,
        opacity: colors.atmosphereOpacity,
        side: THREE.BackSide,
      }),
    );
    scene.add(atmosphereMesh);

    rebuildMarkers();
    rebuildRoutes();
    lastSignature = getStateSignature(props.points, props.userLocation);

    resizeRenderer();
    animate();

    resizeObserver = new ResizeObserver(() => resizeRenderer());
    resizeObserver.observe(rootEl.value);
  } catch (error) {
    console.error("[Globe3DMap] Failed to init Three.js globe:", error);
    loadError.value = t("dashboard.map.globeLoadFailed");
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.points, props.userLocation] as const,
  ([points, userLocation]) => {
    const nextSignature = getStateSignature(points, userLocation);
    if (nextSignature === lastSignature) return;
    lastSignature = nextSignature;
    rebuildMarkers();
    rebuildRoutes();
  },
  { deep: true },
);

watch(
  () => themeStore.isDark,
  async () => {
    destroyScene();
    await initScene();
  },
);

onMounted(() => {
  initScene();
});

onUnmounted(() => {
  destroyScene();
});
</script>

<template>
  <div
    class="globe-shell relative overflow-hidden rounded-[1.4rem] border"
    :class="shellClass"
  >
    <div class="globe-grid pointer-events-none absolute inset-0" />
    <div
      class="pointer-events-none absolute left-[0.9rem] top-[0.9rem] z-[1] h-[2.8rem] w-[2.8rem] rounded-tl-[0.6rem] border-l-2 border-t-2"
      :class="frameClass"
    />
    <div
      class="pointer-events-none absolute right-[0.9rem] top-[0.9rem] z-[1] h-[2.8rem] w-[2.8rem] rounded-tr-[0.6rem] border-r-2 border-t-2"
      :class="frameClass"
    />
    <div
      class="pointer-events-none absolute bottom-[0.9rem] left-[0.9rem] z-[1] h-[2.8rem] w-[2.8rem] rounded-bl-[0.6rem] border-b-2 border-l-2"
      :class="frameClass"
    />
    <div
      class="pointer-events-none absolute bottom-[0.9rem] right-[0.9rem] z-[1] h-[2.8rem] w-[2.8rem] rounded-br-[0.6rem] border-b-2 border-r-2"
      :class="frameClass"
    />
    <div
      ref="rootEl"
      class="canvas-host relative z-[2] h-[380px] w-full md:h-[540px]"
    />
    <div
      v-if="tooltip.visible"
      class="pointer-events-none absolute z-[8] max-w-[260px] rounded-2xl border px-[0.95rem] py-[0.8rem] text-xs leading-[1.35] backdrop-blur-[14px]"
      :class="tooltipPanelClass"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
    >
      <div class="font-semibold">{{ tooltip.title }}</div>
      <div :class="tooltipMetaClass">
        {{ t("dashboard.map.tooltip.nodeCount", { count: tooltip.count }) }}
      </div>
      <div class="mt-2 flex flex-col gap-1" :class="tooltipListClass">
        <span v-for="node in tooltip.nodes" :key="node">{{ node }}</span>
      </div>
    </div>
    <div
      v-if="loading || loadError"
      class="absolute inset-0 z-[5] flex items-center justify-center text-sm backdrop-blur-[8px]"
      :class="[
        overlayClass,
        loadError
          ? themeMode.overlayErrorTextClass
          : themeMode.overlayLoadingTextClass,
      ]"
    >
      {{ loadError || t("dashboard.map.globeLoading") }}
    </div>
  </div>
</template>

<style scoped>
.globe-shell {
  background: rgba(243, 249, 255, 0.98);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    inset 0 0 0 1px rgba(125, 211, 252, 0.14),
    0 16px 36px rgba(14, 165, 233, 0.08);
}

.globe-grid {
  background-image:
    linear-gradient(rgba(14, 165, 233, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.24;
  mask-image: radial-gradient(
    circle at 50% 50%,
    rgba(0, 0, 0, 0.88),
    transparent 100%
  );
}

.canvas-host :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.globe-shell.theme-dark {
  background:
    radial-gradient(
      circle at 50% 30%,
      rgba(34, 211, 238, 0.16),
      transparent 28%
    ),
    radial-gradient(
      circle at 18% 18%,
      rgba(255, 255, 255, 0.04),
      transparent 18%
    ),
    linear-gradient(180deg, rgba(7, 17, 29, 0.96) 0%, rgba(2, 8, 20, 0.98) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 0 0 0 1px rgba(34, 211, 238, 0.04),
    0 22px 60px rgba(2, 8, 23, 0.4);
}

.globe-shell.theme-dark .globe-grid {
  background-image:
    linear-gradient(rgba(103, 232, 249, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(103, 232, 249, 0.05) 1px, transparent 1px);
  opacity: 0.45;
}

@media (max-width: 768px) {
  .globe-grid {
    background-size: 24px 24px;
  }
}
</style>
