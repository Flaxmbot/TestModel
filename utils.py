import cv2
import numpy as np

def letterbox(im, new_shape=(640,640), color=(114,114,114), auto=True, scaleFill=False, scaleup=True, stride=32):
    shape = im.shape[:2]
    r = min(new_shape[0]/shape[0], new_shape[1]/shape[1])
    if not scaleup: r = min(r,1.0)
    new_unpad = (int(shape[1]*r), int(shape[0]*r))
    dw, dh = new_shape[1]-new_unpad[0], new_shape[0]-new_unpad[1]
    if auto:
        dw, dh = np.mod(dw,stride), np.mod(dh,stride)
    elif scaleFill:
        dw, dh = 0,0
        new_unpad = (new_shape[1], new_shape[0])
        r = (new_shape[1]/shape[1], new_shape[0]/shape[0])
    dw/=2; dh/=2
    im = cv2.resize(im, new_unpad, interpolation=cv2.INTER_LINEAR)
    top, bottom = int(round(dh-0.1)), int(round(dh+0.1))
    left, right = int(round(dw-0.1)), int(round(dw+0.1))
    im = cv2.copyMakeBorder(im, top,bottom,left,right, cv2.BORDER_CONSTANT, value=color)
    return im, r, (dw, dh)

def xywh2xyxy(x):
    y = x.copy()
    y[:,0] = x[:,0]-x[:,2]/2
    y[:,1] = x[:,1]-x[:,3]/2
    y[:,2] = x[:,0]+x[:,2]/2
    y[:,3] = x[:,1]+x[:,3]/2
    return y

def box_iou(b1, b2):
    def area(box): return (box[:,2]-box[:,0])*(box[:,3]-box[:,1])
    a1, a2 = area(b1), area(b2)
    lt = np.maximum(b1[:,None,:2], b2[:,:2])
    rb = np.minimum(b1[:,None,2:], b2[:,2:])
    wh = np.clip(rb-lt,0,None)
    inter = wh[:,:,0]*wh[:,:,1]
    return inter/(a1[:,None]+a2-inter)

def non_max_suppression(pred, conf_thres=0.25, iou_thres=0.45):
    if pred is None or not len(pred): return None
    mask = pred[:,4]>conf_thres
    pred = pred[mask]
    if not pred.shape[0]: return None
    boxes = xywh2xyxy(pred[:,:4])
    scores = pred[:,4]
    classes = pred[:,5].astype(int)
    idxs = scores.argsort()[::-1]
    keep=[]
    while idxs.size:
        i=idxs[0]; keep.append(i)
        if idxs.size==1: break
        ious=box_iou(boxes[i:i+1], boxes[idxs[1:]])[0]
        idxs=idxs[1:][ious<iou_thres]
    return np.hstack((boxes[keep], scores[keep,None], classes[keep,None]))