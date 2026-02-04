import {combineReducers} from "redux"
import models from "./models"
import detections from "./detections"
export default combineReducers({
    models,
    detections,
})