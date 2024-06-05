pets = [
    {"name": "Rex", "type": "dog", "age": 6},
    {"name": "Misty", "type": "cat", "age": 4},
    {"name": "Spot", "type": "dog", "age": 7},
    {"name": "Tweety", "type": "bird", "age": 2},
    {"name": "Rover", "type": "dog", "age": 10},
    {"name": "Fluffy", "type": "cat", "age": 1},
    {"name": "Fido", "type": "dog", "age": 3}
]


answer = [pet['name'] for pet in pets] #works

answer = list([pet['name'] for pet in pets if pet['age'] > 6]).sort()

# answer.sort()

print(answer)