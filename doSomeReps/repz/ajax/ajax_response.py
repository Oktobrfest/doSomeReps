from flask import jsonify


class AjaxResponse:
    def __init__(self, data = [], msg :str = '', msg_category :str = 'success', status :str ='ok'):
        self.data = data
        self.msg = msg
        self.msg_category = msg_category
        self.status = status

    def create_response(self):
        return jsonify({
            "data": self.data or [],
            "msg": self.msg,
            "msg_category": self.msg_category,
            "status": self.status            
        })
