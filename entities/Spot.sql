{
  "name": "Spot",
  "type": "object",
  "properties": {
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "lat": {
      "type": "number"
    },
    "lng": {
      "type": "number"
    },
    "spot_type": {
      "type": "string",
      "enum": [
        "parking",
        "food",
        "toilet"
      ],
      "description": "Primary category of the spot"
    },
    "rating": {
      "type": "number",
      "description": "Average rating 1-5"
    },
    "rating_count": {
      "type": "number",
      "default": 0
    },
    "image_url": {
      "type": "string"
    },
    "is_public": {
      "type": "boolean",
      "default": true
    }
  },
  "required": [
    "lat",
    "lng",
    "spot_type"
  ]
}