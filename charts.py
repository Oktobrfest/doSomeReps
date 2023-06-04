

import matplotlib.pyplot as plt
import numpy as np
from io import BytesIO
import base64

def rep_vs_forget(repetition_days_real):


    repetition_days = [round(day) for day in repetition_days_real]

    # Starting decay rate
    decay_rate = 0.05

    # Reduction in decay rate after each repetition
    decay_reduction = 0.011

    # Assuming that x values are in days and y values are in percentages
    x_values = np.arange(0.0, 91.0) 

    y_values_forgetting_curve = 100 * np.exp(-decay_rate * x_values) # Exponential decay function

    # Adjust forgetting curve for spaced repetition
    y_values_spaced_repetition = np.copy(y_values_forgetting_curve)
    for i, interval in enumerate(repetition_days):
        current_decay_rate = max(decay_rate - i * decay_reduction, 0.005)
        # Calculate the new values after repetition
        new_values = 100 * np.exp(-current_decay_rate * np.arange(len(x_values) - (interval + 1)))
        # Take the maximum of the current and new values, capped at 100
        y_values_spaced_repetition[(interval + 1):] = np.minimum(np.maximum(y_values_spaced_repetition[(interval + 1):], new_values), 100)

    plt.figure(figsize=(10,6))
    plt.plot(x_values, y_values_forgetting_curve, label='Natural Retention / Forgetting Curve')
    plt.plot(x_values, y_values_spaced_repetition, label='Spaced Repetition')

    plt.title('Spaced Repetition vs Forgetting Curve')
    plt.xlabel('Time (days)')
    plt.ylabel('Retention (%)')
    plt.legend()
    #add Vertical lines
    for interval in repetition_days:
                plt.axvline(x=interval, color='green', linestyle='--', linewidth=0.5)
                plt.text(interval, 5, str(interval), color='red', ha='center', va='center', fontsize=9, rotation=90)

    # Add horizontal lines along the labels
            
    # Add horizontal lines along the labels
    ax = plt.gca()
    ax.yaxis.grid(True, linestyle='--', linewidth=0.5, color='gray')

    plt.show()


    buffer = BytesIO()
    plt.savefig(buffer, format='png')
    chart_image = base64.b64encode(buffer.getvalue()).decode('utf-8')

    return chart_image
