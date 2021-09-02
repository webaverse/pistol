# pistol

Pistol that can shoot projectiles.

![](https://i.imgur.com/tSyVgXO.png)

Guide: https://docs.webaverse.com/docs/create/guns


## `.metaversefile`

The .metaversefile goes in the directory with the GLB file in order to create the XRpackage.

```
{
  "name": "pistol",
  "description": "Pistol XRPackage",
  "xr_type": "webxr-site@0.0.1",
  "start_url": "pistol.glb",
  "components": [
    {
      "type": "use",
      "subtype": "gun",
      "useAnimation": "pistol"
    }
  ]
}
```
