import * as THREE from 'three';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useActivate, useWear, useUse, useLocalPlayer, usePhysics, useScene, getNextInstanceId, getAppByPhysicsId, useWorld, useDefaultModules, useCleanup, useSoundManager} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const localVector = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);
const z180Quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const muzzleOffset = new THREE.Vector3(0, 0.1, 0.25);
const muzzleFlashTime = 300;
const bulletSparkTime = 300;

const emptyArray = [];
const fnEmptyArray = () => emptyArray;

export default () => {
  const app = useApp();
  app.name = 'pistol';
  
  const soundManager = useSoundManager();

  let pistolSound = `${baseUrl}shoot.wav`;
  soundManager.loadSound('pistol',pistolSound);

  const physics = usePhysics();
  const scene = useScene();
  
  /* const _updateSubAppMatrix = subApp => {
    subApp.updateMatrixWorld();
    app.position.copy(subApp.position);
    app.quaternion.copy(subApp.quaternion);
    app.scale.copy(subApp.scale);
    app.matrix.copy(subApp.matrix);
    app.matrixWorld.copy(subApp.matrixWorld);
  }; */
  
  let pointLights = [];
  const gunPointLight = new THREE.PointLight(0xFFFFFF, 5);
  gunPointLight.castShadow = false; 
  gunPointLight.startTime = 0;
  gunPointLight.endTime = 0;
  gunPointLight.initialIntensity = gunPointLight.intensity;
  const world = useWorld();
  const worldLights = world.getLights();
  worldLights.add(gunPointLight);
  pointLights.push(gunPointLight);
  
  const bulletPointLight = new THREE.PointLight(0xef5350, 5, 10);
  bulletPointLight.castShadow = false;
  bulletPointLight.startTime = 0;
  bulletPointLight.endTime = 0;
  bulletPointLight.initialIntensity = bulletPointLight.intensity;
  worldLights.add(bulletPointLight);
  pointLights.push(bulletPointLight);

  let gunApp = null;
  let explosionApp = null;
  let subApps = [null, null];
  (async () => {
    {
      let u2 = `https://webaverse.github.io/pixelsplosion/`;
      if (/^https?:/.test(u2)) {
        u2 = '/@proxy/' + u2;
      }
      const m = await metaversefile.import(u2);
      // console.log('group objects 3', u2, m);
      explosionApp = metaversefile.createApp({
        name: u2,
      });
      explosionApp.contentId = u2;
      explosionApp.instanceId = getNextInstanceId();
      explosionApp.position.copy(app.position);
      explosionApp.quaternion.copy(app.quaternion);
      explosionApp.scale.copy(app.scale);
      explosionApp.updateMatrixWorld();
      explosionApp.name = 'explosion';
      subApps[0] = explosionApp;

      await explosionApp.addModule(m);
      scene.add(explosionApp);
      // metaversefile.addApp(explosionApp);
      
    }
    
    {
      let u2 = `${baseUrl}military.glb`;
      if (/^https?:/.test(u2)) {
        u2 = '/@proxy/' + u2;
      }
      const m = await metaversefile.import(u2);
      gunApp = metaversefile.createApp({
        name: u2,
      });
      gunApp.position.copy(app.position);
      gunApp.quaternion.copy(app.quaternion);
      gunApp.scale.copy(app.scale);
      gunApp.updateMatrixWorld();
      gunApp.name = 'gun';
      gunApp.getPhysicsObjectsOriginal = gunApp.getPhysicsObjects;
      gunApp.getPhysicsObjects = fnEmptyArray;
      subApps[1] = gunApp;
      
      const components = [
        {
          "key": "instanceId",
          "value": getNextInstanceId(),
        },
        {
          "key": "contentId",
          "value": u2,
        },
        {
          "key": "physics",
          "value": true,
        },
        {
          "key": "wear",
          "value": {
            "boneAttachment": "leftHand",
            "position": [-0.04, -0.03, -0.01],
            "quaternion": [0.5, -0.5, -0.5, 0.5],
            "scale": [1, 1, 1]
          }
        },
        {
          "key": "aim",
          "value": {}
        },
        {
          "key": "use",
          "value": {
            "subtype": "pistol"
          }
        }
      ];
      
      for (const {key, value} of components) {
        gunApp.setComponent(key, value);
      }
      await gunApp.addModule(m);
      scene.add(gunApp);
      // metaversefile.addApp(gunApp);
      
      gunApp.addEventListener('use', e => {
        // muzzle flash
        {
          explosionApp.position.copy(gunApp.position)
            .add(
              new THREE.Vector3(0, 0.1, 0.25)
                .applyQuaternion(gunApp.quaternion)
            );
          explosionApp.quaternion.copy(gunApp.quaternion);
          explosionApp.scale.copy(gunApp.scale);
          explosionApp.updateMatrixWorld();
          explosionApp.setComponent('color1', 0x808080);
          explosionApp.setComponent('color2', 0x000000);
          explosionApp.setComponent('gravity', 0.5);
          explosionApp.setComponent('rate', 5);
          explosionApp.use();
          
          gunPointLight.startTime = performance.now();
          gunPointLight.endTime = gunPointLight.startTime + muzzleFlashTime;

          soundManager.play('pistol');
        }
        
        // bullet hit
        {
          const result = physics.raycast(gunApp.position, gunApp.quaternion.clone().multiply(z180Quaternion));
          if (result) {
            explosionApp.position.fromArray(result.point);
            const normal = new THREE.Vector3().fromArray(result.normal);
            explosionApp.quaternion.setFromRotationMatrix(
              new THREE.Matrix4().lookAt(
                explosionApp.position,
                explosionApp.position.clone()
                  .sub(normal),
                upVector
              )
            );
            // explosionApp.scale.copy(gunApp.scale);
            explosionApp.updateMatrixWorld();
            explosionApp.setComponent('color1', 0xef5350);
            explosionApp.setComponent('color2', 0x000000);
            explosionApp.setComponent('gravity', -0.5);
            explosionApp.setComponent('rate', 0.5);
            explosionApp.use();
            
            bulletPointLight.position.copy(explosionApp.position);
            bulletPointLight.startTime = performance.now();
            bulletPointLight.endTime = bulletPointLight.startTime + bulletSparkTime;
          
            const targetApp = getAppByPhysicsId(result.objectId);
            if (targetApp) {
              const damage = 2;
              targetApp.hit(damage, {
                collisionId: targetApp.willDieFrom(damage) ? result.objectId : null,
              });
            } else {
              console.warn('no app with physics id', result.objectId);
            }
          }
        }
      });
    }
  })();
  
  app.getPhysicsObjects = () => {
    return gunApp ? gunApp.getPhysicsObjectsOriginal() : [];
  };
  
  useActivate(() => {
    // console.log('activate', subApps);
    /* for (const subApp of subApps) {
      subApp && subApp.activate();
    } */
    
    const localPlayer = useLocalPlayer();
    localPlayer.wear(app);
  });
  
  let wearing = false;
  useWear(e => {
    const {wear} = e;
    for (const subApp of subApps) {
      subApp.dispatchEvent({
        type: 'wearupdate',
        wear,
      });
    }
    wearing = wear;
  });
  
  useUse(() => {
    if (gunApp) {
      gunApp.use();
    }
  });
  
  useFrame(({timestamp}) => {
    if (!wearing) {
      if (gunApp) {
        gunApp.position.copy(app.position);
        gunApp.quaternion.copy(app.quaternion);
      }
    } else {
      if (gunApp) {
        app.position.copy(gunApp.position);
        app.quaternion.copy(gunApp.quaternion);
      }
    }
    
    if (gunApp) {
      gunPointLight.position.copy(gunApp.position)
        .add(localVector.copy(muzzleOffset).applyQuaternion(gunApp.quaternion));
      gunPointLight.updateMatrixWorld();
    }
      
    for (const pointLight of pointLights) {
      const factor = Math.min(Math.max((timestamp - pointLight.startTime) / (pointLight.endTime - pointLight.startTime), 0), 1);
      pointLight.intensity = pointLight.initialIntensity * (1 - Math.pow(factor, 0.5));
    }
  });
  
  useCleanup(() => {
    for (const subApp of subApps) {
      if (subApp) {
        // metaversefile.removeApp(subApp);
        scene.remove(subApp);
        subApp.destroy();
      }
    }
  });

  return app;
};
