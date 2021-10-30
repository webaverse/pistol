import * as THREE from 'three';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useActivate, useWear, useUse, usePhysics, getNextInstanceId, getAppByPhysicsId, useWorld, useDefaultModules, useCleanup} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const localVector = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);
const z180Quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const muzzleOffset = new THREE.Vector3(0, 0.1, 0.25);
const muzzleFlashTime = 300;
const bulletSparkTime = 300;

export default () => {
  const app = useApp();
  const physics = usePhysics();
  
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

  const subApps = [];
  (async () => {
    {
      let u2 = `https://webaverse.github.io/pixelsplosion/`;
      if (/^https?:/.test(u2)) {
        u2 = '/@proxy/' + u2;
      }
      const m = await metaversefile.import(u2);
      // console.log('group objects 3', u2, m);
      const subApp = metaversefile.createApp({
        name: u2,
      });
      subApp.contentId = u2;
      subApp.instanceId = getNextInstanceId();
      subApp.position.copy(app.position);
      subApp.quaternion.copy(app.quaternion);
      subApp.scale.copy(app.scale);
      subApp.updateMatrixWorld();

      await subApp.addModule(m);
      metaversefile.addApp(subApp);
      subApps.push(subApp);
      
      /* setInterval(() => {
        subApp.activate();
      }, 2000); */
      
    }
    
    {
      let u2 = `${baseUrl}military.glb`;
      if (/^https?:/.test(u2)) {
        u2 = '/@proxy/' + u2;
      }
      const m = await metaversefile.import(u2);
      const subApp = metaversefile.createApp({
        name: u2,
      });
      subApp.position.copy(app.position);
      subApp.quaternion.copy(app.quaternion);
      subApp.scale.copy(app.scale);
      subApp.updateMatrixWorld();
      
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
        subApp.setComponent(key, value);
      }
      await subApp.addModule(m);
      metaversefile.addApp(subApp);
      
      subApp.addEventListener('use', e => {
        const explosionApp = subApps[0];
        
        // muzzle flash
        {
          explosionApp.position.copy(subApp.position)
            .add(
              new THREE.Vector3(0, 0.1, 0.25)
                .applyQuaternion(subApp.quaternion)
            );
          explosionApp.quaternion.copy(subApp.quaternion);
          explosionApp.scale.copy(subApp.scale);
          explosionApp.updateMatrixWorld();
          explosionApp.setComponent('color1', 0x808080);
          explosionApp.setComponent('color2', 0x000000);
          explosionApp.setComponent('gravity', 0.5);
          explosionApp.setComponent('rate', 5);
          explosionApp.use();
          
          gunPointLight.startTime = performance.now();
          gunPointLight.endTime = gunPointLight.startTime + muzzleFlashTime;
        }
        
        // bullet hit
        {
          const result = physics.raycast(subApp.position, subApp.quaternion.clone().multiply(z180Quaternion));
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
            // explosionApp.scale.copy(subApp.scale);
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
      
      subApps.push(subApp);
    }
  })();
  
  /* app.getPhysicsObjects = () => {
    const result = [];
    for (const subApp of subApps) {
      if (subApp) {
        result.push.apply(result, subApp.getPhysicsObjects());
      }
    }
    return result;
  }; */
  
  useFrame(({timestamp}) => {
    const gunApp = subApps[1];
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
  
  useActivate(() => {
    for (const subApp of subApps) {
      subApp && subApp.activate();
    }
  });
  
  useWear(() => {
    for (const subApp of subApps) {
      subApp && subApp.wear();
    }
  });
  
  useUse(() => {
    for (const subApp of subApps) {
      subApp && subApp.use();
    }
  });
  
  useCleanup(() => {
    for (const subApp of subApps) {
      if (subApp) {
        metaversefile.removeApp(subApp);
        subApp.destroy();
      }
    }
  });

  return app;
};