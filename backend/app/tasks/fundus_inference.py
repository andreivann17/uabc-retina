import numpy as np
import cv2
from tensorflow.keras.preprocessing.image import img_to_array, ImageDataGenerator
from keras.layers import BatchNormalization
import tensorflow as tf
import time

model_map = {}


# Monkey patch para aceptar lista en 'axis'
original_init = BatchNormalization.__init__
def patched_init(self, *args, **kwargs):
    if 'axis' in kwargs and isinstance(kwargs['axis'], list):
        kwargs['axis'] = kwargs['axis'][0]
    original_init(self, *args, **kwargs)
BatchNormalization.__init__ = patched_init

# Normalización
datagen = ImageDataGenerator(
    featurewise_center=True,
    featurewise_std_normalization=True,
)

def prepare_image(img_path):
    img = cv2.imread(img_path, cv2.IMREAD_COLOR)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (224, 224)) 
    img = img / 255.0  
    img = img_to_array(img)
    img = np.expand_dims(img, axis=0)
    img = datagen.standardize(img[0])  
    img = np.expand_dims(img, axis=0) 
    return img



def predict_image(img_path, id_disease):
    img = prepare_image(img_path)
    model = model_map[int(id_disease)]["model"]
    start_time = time.time()

  
    # Confirmar si se está usando GPU
    device = ""
    if tf.config.list_physical_devices('GPU'):

        device = "GPU"
    else:
        device = "CPU"

    preds = model.predict(img)[0]  # ← vector de probabilidades
    inference_time = round((time.time() - start_time) * 1000, 2)
    predicted_class_idx = int(np.argmax(preds))
    summary_results = ["0"] * len(preds)
    summary_results[predicted_class_idx] = "1"

    return {
        "device":device,
        "time_inference": inference_time,
        "id_model": model_map[int(id_disease)]["id_model"],
        "stages": model_map[int(id_disease)]["stages"],
        "summary": summary_results,
        "predicted_class": predicted_class_idx,
        "vector_probs": preds.tolist(),
    }
def init_stages_models_from_sql():  



    # Agrupar por id_disease
    disease_models = {}
    model_cache = {}

    for row in rows:
        id_disease = row["id_disease"]
        path = row["path"]

        # Cargar solo una vez por path
        if path not in model_cache:
            model_path = find_model_file(path, "tensorflow")
            if not model_path:
                print("No se encontró modelo TensorFlow en:", path)
                continue
            model_loaded = tf.keras.models.load_model(model_path)

            
            model_cache[path] = {
                "model": model_loaded,
            
            }

        # Si no existe aún el id_disease en el diccionario, lo agregamos
        if id_disease not in disease_models:
            disease_models[id_disease] = {
                "path": path,
                "id_model": row["id_model"],
                "model": model_cache[path]["model"],
                "stages": []
            }

        # Agregar stage a la lista de stages del id_disease correspondiente
        disease_models[id_disease]["stages"].append({
            "id_stage": row["id_stage"],
            "id_model_stage":row["id_model_stage"],
            "index_class": row["index_class"],
        })
    
    return disease_models


def __main__():
    global model_map
    model_map = init_stages_models_from_sql()
__main__()
"""
# 🔍 Ejemplo de uso
if __name__ == "__main__":
    path = r"f:\dataset\fundus\images\aptos\train_images_crop\0369f3efe69b.png"
    result = predict_image(path)
    print(result)


"""