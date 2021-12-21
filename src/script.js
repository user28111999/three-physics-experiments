
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js'

import * as CANNON from "cannon-es"

/**
 * Base
 */

const canvas = document.querySelector('canvas')

const scene = new THREE.Scene()
scene.background = new THREE.Color(0xf0f0f0)

const size = {
    width: window.innerWidth,
    height: window.innerHeight,
    aspectRatio: window.innerWidth / window.innerHeight
}

/**
 * Camera
 */

const camera = new THREE.PerspectiveCamera(80, size.aspectRatio)
camera.position.set(0, 2, 5)

scene.add(camera)

/**
 * Utils
 */

const controls = new OrbitControls(camera, canvas)

const getHitPoint = (clientX, clientY, mesh, camera) => {
    const mouse = new THREE.Vector2()

    mouse.x = (clientX / size.width) * 2 - 1
    mouse.y = -((clientY / size.height) * 2 - 1)

    raycaster.setFromCamera(mouse, camera)

    const collide = raycaster.intersectObject(mesh)
    
    return collide.length > 0 ? collide[0].point : undefined
}

/**
 * Renderer
 */

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    powerPreference: 'high-performance',
    antialias: true
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(size.width, size.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/**
 * Lights
 */

scene.add( new THREE.AmbientLight(0xf0f0f0))
const spotLight = new THREE.SpotLight(0xffffff, 1.5)

spotLight.position.set(0, 1500, 200)
spotLight.angle = Math.PI * 0.2
spotLight.castShadow = true
spotLight.shadow.camera.near = 200
spotLight.shadow.camera.far = 2000
spotLight.shadow.bias = - 0.000222
spotLight.shadow.mapSize.width = 1024
spotLight.shadow.mapSize.height = 1024

scene.add(spotLight)

/**
 * Raycaster
 */

const raycaster = new THREE.Raycaster()

/**
 * Meshes
 */

let meshes = []

// Plane

const planeGeo = new THREE.PlaneBufferGeometry(100, 100, 1, 1)
const planeMat = new THREE.MeshLambertMaterial({ color: 0x777777 })
const planeMesh = new THREE.Mesh(planeGeo, planeMat)

planeGeo.rotateX(-Math.PI / 2)

scene.add(planeMesh)

// Helper

const mouseHelperGeo = new THREE.SphereBufferGeometry(0.2, 8, 8)
const mouseHelperMat = new THREE.MeshLambertMaterial({ color: 0xff0000 })
const mouseHelperMesh = new THREE.Mesh(mouseHelperGeo, mouseHelperMat)

mouseHelperMesh.visible = false

scene.add(mouseHelperMesh)

const planeMoveGeo = new THREE.PlaneBufferGeometry(100, 100)
const movementPlaneMesh = new THREE.Mesh(planeMoveGeo, planeMat)

movementPlaneMesh.visible = false

scene.add(movementPlaneMesh)

// Test cube

const cubeGeo = new THREE.BoxBufferGeometry(1, 1, 1, 10, 10)
const cubeMat = new THREE.MeshPhongMaterial({ color: 0x999999 })
const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat)

meshes.push(cubeMesh)
scene.add(cubeMesh)

/**
 * Physics
 */

let jointConstraint, hitPoint
let bodies = []
let isDragging = false

const world = new CANNON.World()
world.gravity.set(0, -10, 0)

// Plane

const planeShape = new CANNON.Plane()
const planeBody = new CANNON.Body({ mass: 0 })

planeBody.addShape(planeShape)
planeBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)

world.addBody(planeBody)

// Test Cube

const testCubeShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5))
const testCubeBody = new CANNON.Body({ mass: 5 })

testCubeBody.addShape(testCubeShape)
testCubeBody.position.set(0, 5, 0)

bodies.push(testCubeBody)
world.addBody(testCubeBody)

const jointShape = new CANNON.Sphere(0.1)
const jointBody = new CANNON.Body({ mass: 0 })

jointBody.addShape(jointShape)
jointBody.collisionFilterGroup = 0
jointBody.collisionFilterMask = 0

world.addBody(jointBody)

// Add a constraint between the cube and the jointBody in the initeraction position
const addJointConstraint = (position, constrainedBody) => {
    const vector = new CANNON.Vec3()
        .copy(position)
        .vsub(constrainedBody.position)

    const antiRotation = constrainedBody.quaternion.inverse()
    const pivot = antiRotation.vmult(vector)

    jointBody.position.copy(position)

    jointConstraint = new CANNON.PointToPointConstraint(
        constrainedBody, 
        pivot, 
        jointBody, 
        new CANNON.Vec3(0, 0, 0)
    )

    world.addConstraint(jointConstraint)
}

const moveJoint = (position) => {
    jointBody.position.copy(position)
    jointConstraint.update()
}

const moveMesh = (position) => {
    mouseHelperMesh.position.copy(position)
}

const moveMomentPlane = (point, camera) => {
    mouseHelperMesh.position.copy(point)
    mouseHelperMesh.quaternion.copy(camera.quaternion)
}

const removeJointConstraint = () => {
    world.removeConstraint(jointConstraint)
    jointConstraint = undefined
}

/**
 * Post-FX
 */

const composer = new EffectComposer(renderer)

const ssaoPass = new SSAOPass(
    scene,
    camera,
    size.width,
    size.height
)

ssaoPass.kernelRadius = 16
ssaoPass.minDistance = 0.005
ssaoPass.maxDistance = 0.1

composer.addPass(ssaoPass)

/**
 * Event listeners
 */

window.addEventListener("pointerup", () => {
    isDragging = false
    removeJointConstraint()
})

window.addEventListener("pointerdown", (event) => {
    hitPoint = getHitPoint(
        event.clientX,
        event.clientY,
        cubeMesh,
        camera
    )

    if (!hitPoint) return

    moveMesh(hitPoint)
    moveMomentPlane(hitPoint, camera)
    addJointConstraint(hitPoint, testCubeBody)

    requestAnimationFrame(() => isDragging = !isDragging)
})

window.addEventListener("pointermove", (event) => {
    if (!isDragging) return

    hitPoint = getHitPoint(
        event.clientX, 
        event.clientY, 
        mouseHelperMesh, 
        camera
    )

    if (!hitPoint) return

    moveMesh(hitPoint)
    moveJoint(hitPoint)
})

window.addEventListener('resize', () => {
    size.width = window.innerWidth
    size.height = window.innerHeight

    camera.aspect = size.width / size.height
    camera.updateProjectionMatrix()

    composer.setSize(size.width, size.height)

    renderer.setSize(size.width, size.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})


/**
 * Update
 */

let lastCallTime
const timeStep = 1 / 60 

const updatePhysics = () => {
    const time = performance.now() / 1000

    if (!lastCallTime) {
        world.step(timeStep)
    } else {
        const dt = time - lastCallTime
        world.step(timeStep, dt)
    }

    lastCallTime = time
}

const tick = () => {
    // const elapsedTime = clock.getElapsedTime()
    // console.log({
        //     x: camera.position.x,
        //     y: camera.position.y,
        //     z: camera.position.z
        // })
        
        updatePhysics()
        
        for (let i = 0; i !== meshes.length; i++) {
            meshes[i].position.copy(bodies[i].position)
            meshes[i].quaternion.copy(bodies[i].quaternion)
        }
        
    composer.render()
    controls.update()
    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}

tick()
