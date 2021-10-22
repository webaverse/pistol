import * as THREE from 'three';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useActivate, useWear, useUse, usePhysics, getNextInstanceId, getAppByPhysicsId, useWorld, useDefaultModules, useCleanup} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const upVector = new THREE.Vector3(0, 1, 0);
const z180Quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

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

  const subApps = [];
  (async () => {
    {
      let u2 = `/pixelsplosion/`;
      if (/^https?:/.test(u2)) {
        u2 = '/@proxy/' + u2;
      }
      const m = await metaversefile.import(u2);
      // console.log('group objects 3', u2, m);
      const subApp = metaversefile.createApp({
        name: u2,
      });
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
          "value": {}
        }
      ];
      
      for (const {key, value} of components) {
        subApp.setComponent(key, value);
      }
      await subApp.addModule(m);
      metaversefile.addApp(subApp);
      
      subApp.addEventListener('use', e => {
        const explosionApp = subApps[0];
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
        }
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
  
  app.getPhysicsObjects = () => {
    const result = [];
    for (const subApp of subApps) {
      if (subApp) {
        result.push.apply(result, subApp.getPhysicsObjects());
      }
    }
    return result;
  };
  
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