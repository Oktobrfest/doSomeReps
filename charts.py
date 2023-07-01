

import matplotlib.pyplot as plt
import numpy as np
from io import BytesIO
import base64

def rep_vs_forget(repetition_days_real):
    repetition_days = [round(day) for day in repetition_days_real]
    
    # Starting decay rate
    decay_rate = 0.05

    # Reduction in decay rate after each repetition
    decay_reduction = 0.009

    # Assuming that x values are in days and y values are in percentages
    x_values = np.arange(0.0, 91.0) 
   
    # Exponential decay function (less steep.
    # y_values_forgetting_curve = 100 * np.exp(-decay_rate * x_values) # 
   
    # Ebbinghaus forgetting curve
    y_values_forgetting_curve = 100 - (100 * np.log10(x_values + 1) / np.log10(60 + 1))

    # Adjust forgetting curve for spaced repetition
    y_values_spaced_repetition = np.copy(y_values_forgetting_curve)
    for i, interval in enumerate(repetition_days):
        current_decay_rate = max(decay_rate - i * decay_reduction, 0.005)
        # Calculate the new values after repetition
        new_values = 100 * np.exp(-current_decay_rate * np.arange(len(x_values) - (interval)))
        # Take the maximum of the current and new values, capped at 100
        y_values_spaced_repetition[(interval):] = np.minimum(np.maximum(y_values_spaced_repetition[(interval):], new_values), 100)

    plt.figure(figsize=(10,6))

    plt.plot(x_values, y_values_forgetting_curve, label='Retention / Ebbinghaus Forgetting Curve')
    plt.plot(x_values, y_values_spaced_repetition, label='Spaced Repetition')
            
    # Add horizontal lines along the labels
    ax = plt.gca()
    ax.yaxis.grid(True, linestyle='--', linewidth=0.5, color='gray')

    font_sizes = {
    'small': 12,
    'medium': 16,
    'large': 20
    }

    # Get the current screen width
    screen_width = plt.gcf().get_size_inches()[0] * plt.gcf().dpi

    # Choose the appropriate font size based on the screen width
    if screen_width < 600:
        font_size = font_sizes['small']
    elif screen_width < 1000:
        font_size = font_sizes['medium']
    else:
        font_size = font_sizes['large']

    plt.legend(fontsize=font_size)
    
    # Increase the font size of the title
    plt.title('Spaced Repetition vs Forgetting Curve', fontsize=font_size + 2)

    # Increase the font size of the axis labels
    plt.xlabel('Time (days)', fontsize=font_size)
    plt.ylabel('Retention (%)', fontsize=font_size)

    # Increase the font size of the vertical line labels
    for interval in repetition_days:
        plt.axvline(x=interval, color='green', linestyle='--', linewidth=0.5)

        plt.text(interval, 5, str(interval), color='red', ha='center', va='top',
                fontsize=font_size - 2, rotation=90)

    plt.show()
    
    buffer = BytesIO()
    plt.savefig(buffer, format='png')
    chart_image = base64.b64encode(buffer.getvalue()).decode('utf-8')

    return chart_image

def render_chart(x_arr, y_arr, x_label, y_label):
    # Create sample data
    x = np.array(x_arr)
    y = np.array(y_arr)  
        
    # Create the bar chart
    fig, ax = plt.subplots()
    ax.bar(x, y)
    
         # Set the axis labels
    ax.set_xlabel(x_label)
    ax.set_ylabel(y_label)

    # Rotate x-axis labels by 45 degrees
    ax.set_xticklabels(x, rotation=-35, ha='left')

    if y_label == 'Questions':
        ax.yaxis.set_major_locator(plt.MaxNLocator(integer=True))

    # Adjust the layout to prevent labels from being cut off
    plt.tight_layout()
    # Alternatively, you can manually adjust the bottom margin
    # plt.subplots_adjust(bottom=0.2)

    # Render the chart to a base64-encoded string
    buffer = BytesIO()
    fig.savefig(buffer, format='png')
    chart_image = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    return chart_image


