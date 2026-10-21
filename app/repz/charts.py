from io import BytesIO
import base64

import logging
import matplotlib
matplotlib.use('Agg')  # non-interactive backend for server-side rendering
logging.getLogger('matplotlib.font_manager').setLevel(logging.WARNING)
import matplotlib.pyplot as plt
import numpy as np

# Color palette matching D3's schemeTableau10 + schemePaired + schemeSet3
# used by DailyActivityChart in frontend/src/home/DailyActivityChart.tsx
D3_COLOR_PALETTE = [
    # Tableau 10
    "#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f",
    "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#bab0ab",
    # Paired
    "#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99",
    "#e31a1c", "#fdbf6f", "#ff7f00", "#cab2d6", "#6a3d9a",
    "#ffff99", "#b15928",
    # Set3
    "#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3",
    "#fdb462", "#b3de69", "#fccde5", "#d9d9d9", "#bc80bd",
    "#ccebc5", "#ffed6f",
]


def get_category_color_map(
    daily_history: list[dict] | None = None,
    extra_categories: list[str] | None = None,
) -> dict[str, str]:
    """
    Computes a deterministic category -> color mapping matching the
    DailyActivityChart legend on the home page.
    Categories are ordered by total answer count descending in daily history,
    breaking ties alphabetically. Any extra categories (e.g. from due questions)
    that have no prior activity are appended deterministically.
    """
    tally: dict[str, int] = {}
    for entry in daily_history or []:
        for cat, count in (entry.get("correct") or {}).items():
            tally[cat] = tally.get(cat, 0) + count
        for cat, count in (entry.get("incorrect") or {}).items():
            tally[cat] = tally.get(cat, 0) + count

    sorted_cats = [
        cat for cat, _ in sorted(tally.items(), key=lambda item: (-item[1], item[0]))
    ]

    color_map: dict[str, str] = {}
    for cat in sorted_cats:
        color_map[cat] = D3_COLOR_PALETTE[len(color_map) % len(D3_COLOR_PALETTE)]

    for cat in extra_categories or []:
        if cat not in color_map:
            color_map[cat] = D3_COLOR_PALETTE[len(color_map) % len(D3_COLOR_PALETTE)]

    return color_map


def rep_vs_forget(repetition_days_real):
    repetition_days = [round(day) for day in repetition_days_real[:10]]
    
    # Starting decay rate
    decay_rate = 0.06

    # Reduction in decay rate after each repetition
    decay_reduction = 0.009
    
    # Assuming that x values are in days and y values are in percentages
    # x_values = np.arange(0.0, 91.0) 
    x_values = np.arange(0.0, repetition_days[-1] + 1) 
   
    # Exponential decay function (less steep.
    # y_values_forgetting_curve = 100 * np.exp(-decay_rate * x_values + 1) # 
    base_value = 60 
    # Ebbinghaus forgetting curve
    y_values_forgetting_curve = 100 - (100 * (np.log10(x_values + 1) / np.log10(base_value + 1) - np.log10(1 + 1) / np.log10(base_value + 1)))
   
    # y_values_forgetting_curve = 100 - (100 * np.log10(x_values + 1) / np.log10(base_value + 1))
    y_values_forgetting_curve = np.maximum(y_values_forgetting_curve, 10)
    y_values_forgetting_curve = np.minimum(y_values_forgetting_curve, 100)

    # Adjust forgetting curve for spaced repetition
    y_values_spaced_repetition = np.copy(y_values_forgetting_curve)
    for i, interval in enumerate(repetition_days[3:], start = 4):
        current_decay_rate = max(min(decay_rate - i * decay_reduction, decay_rate), 0.002)
        # Calculate the new values after repetition
        new_values = 100 * np.exp(-current_decay_rate * np.arange(len(x_values) - (interval)))
        # Take the maximum of the current and new values, capped at 100
        y_values_spaced_repetition[(interval):] = np.minimum(np.maximum(y_values_spaced_repetition[(interval):], new_values), 100)
        y_values_spaced_repetition[interval] = 100

    plt.figure(figsize=(10,6))

    plt.plot(x_values, y_values_forgetting_curve, label='Retention / Ebbinghaus Forgetting Curve')
    plt.plot(x_values, y_values_spaced_repetition, label='Spaced Repetition')
            
    # Add horizontal lines along the labels
    ax = plt.gca()
    ax.set_xscale('log')
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


def render_chart(x_arr, y_arr, x_label, y_label, colors=None):
    # Create sample data
    x = np.array(x_arr)
    y = np.array(y_arr)  
        
    # Scale figure to span wide layout matching the activity chart
    num_items = len(x)
    fig_width = max(10.0, min(16.0, num_items * 0.85 + 2.0)) if num_items > 0 else 10.0
    fig, ax = plt.subplots(figsize=(fig_width, 4.2))

    # Control bar width up to a sensible limit of ridiculousness
    bar_width = 0.55 if num_items > 6 else 0.45 if num_items > 3 else 0.35
    if colors is not None:
        ax.bar(x, y, width=bar_width, color=colors, edgecolor='white', linewidth=0.5)
    else:
        ax.bar(x, y, width=bar_width)
    
    # Set the axis labels
    ax.set_xlabel(x_label)
    ax.set_ylabel(y_label)

    # Set xticks and rotate x-axis labels by 35 degrees
    ax.set_xticks(range(len(x)))
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
    plt.close(fig)
    return chart_image
